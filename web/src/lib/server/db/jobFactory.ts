import AppSettings from "$lib/server/settings";
import { AreaType, CrawlCommand, JobStatus, type TokenProvider } from "$lib/types";
import type { ResultSet } from "@libsql/client";
import { getLogger } from "@logtape/logtape";
import { and, eq, gt, inArray } from "drizzle-orm"; // Added gt
import path from "node:path";
import { ulid } from "ulid";
import { db } from ".";
import type { AreaInformation, AuthorizationScopesResult } from "../utils";
import { handleNewArea } from "$lib/server/job-manager"; // Added import
import { account } from "./auth-schema";
import { area, job, type JobInsert, type Job as JobType } from "./base-schema";

const logger = getLogger(["backend", "db", "jobFactory"]); // Align category with hooks.server.ts

export type JobSearchResults = {
  id: string;
  provider: string;
  token: string | null;
  refreshToken: string | null;
  idToken: string | null;
  status: JobStatus;
  command: CrawlCommand;
  full_path: string | null;
}[];

export async function jobSearch(userId: string): Promise<JobSearchResults>;
export async function jobSearch(
  provider: TokenProvider,
  fullPaths: string[]
): Promise<JobSearchResults>;
export async function jobSearch(
  userId_Provider: TokenProvider | string,
  fullPaths?: string[]
): Promise<JobSearchResults> {
  const query = [];
  if (fullPaths) {
    userId_Provider = userId_Provider as TokenProvider;
    fullPaths = fullPaths!;
    if (fullPaths.length <= 0) return [];
    query.push(inArray(job.full_path, fullPaths));
    query.push(eq(account.providerId, userId_Provider));
  } else {
    userId_Provider = userId_Provider as string;
    query.push(eq(job.command, CrawlCommand.authorizationScope));
    query.push(eq(account.userId, userId_Provider));
  }

  const results = await db
    .select({
      id: job.id,
      provider: account.providerId,
      token: account.accessToken,
      refreshToken: account.refreshToken,
      idToken: account.idToken,
      status: job.status,
      command: job.command,
      full_path: job.full_path
    })
    .from(job)
    .innerJoin(account, eq(job.accountId, account.id))
    .where(and(...query));
  return results;
}

const _toJobLookup = (
  provider: TokenProvider,
  full_path: string | undefined | null,
  command: CrawlCommand,
  id: string,
  status: JobStatus
) => {
  return {
    [provider]: {
      [full_path ?? ""]: {
        [command]: {
          id,
          status
        }
      }
    }
  } as ExistingJobLookup;
};

export const toJobLookup = (jobs: JobSearchResults): ExistingJobLookup => {
  return jobs
    .map((x) => _toJobLookup(x.provider as TokenProvider, x.full_path, x.command, x.id, x.status))
    .reduce(merge, {} as ExistingJobLookup);
};

const merge = <T extends { [key: string]: any }>(objA: T, objB: T) => {
  for (const keyB in objB) {
    const valueB = objB[keyB as keyof typeof objB];
    const keyA = keyB as keyof typeof objA;
    const valueA = keyB in objA ? objA[keyA] : undefined;
    if (!valueA) {
      objA = Object.assign(objA, { [keyB]: [valueB] as any[] });
    } else if (Array.isArray(objA[keyA])) {
      objA[keyA].push(valueB);
    } else {
      if (typeof objA[keyA] === "object") {
        objA[keyA] = merge(objA[keyA], objB[keyB]);
      } else {
        logger.warn("Attempting strange object merge with keys A ({keyA}) and B ({keyB})", {
          objA,
          objB,
          keyA,
          keyB
        });
      }
    }
  }

  for (const keyB in objB) {
    const valueB = objB[keyB as keyof typeof objB];
    const valueA = keyB in objA ? objA[keyB as keyof typeof objA] : undefined;
    if (!valueA) {
      objA = Object.assign(objA, { [keyB]: [valueB] as any[] });
    } else if (Array.isArray(objA[keyB as keyof typeof objA])) {
      objA[keyB as keyof typeof objA].push(valueB);
    } else {
      const valueA = objA[keyB as keyof typeof objA];
      objA = Object.assign(objA, { [keyB]: [valueA, valueB] as any[] });
    }
  }
  return objA;
};

export const newJob = async (
  accountId: string,
  command: CrawlCommand,
  previousJobId?: string,
  fullPath?: string
): Promise<JobInsert> => {
  const accountDetails = await db.query.account.findFirst({
    where: eq(account.id, accountId),
    columns: { providerId: true }
  });

  let gitlabGraphQLUrl: string | undefined = undefined;
  if (accountDetails && accountDetails.providerId) {
    const baseUrl = providerToBaseURL(accountDetails.providerId);
    if (baseUrl) {
      gitlabGraphQLUrl = `${baseUrl.replace(/\/$/, "")}/api/graphql`;
    } else {
      logger.warn(`Could not determine baseUrl for providerId: ${accountDetails.providerId} for accountId: ${accountId}. gitlabGraphQLUrl will be undefined.`);
    }
  } else {
    logger.warn(`Account details or providerId not found for accountId: ${accountId}. gitlabGraphQLUrl will be undefined.`);
  }

  return {
    accountId: accountId,
    full_path: fullPath,
    command: command,
    spawned_from: previousJobId,
    gitlabGraphQLUrl: gitlabGraphQLUrl, // Add the new field here
    // Ensure other JobInsert fields are defaulted if necessary by Drizzle or DB schema
    // For example, id, created_at, status are typically handled by DB/Drizzle $defaultFn or default().
    // Explicitly setting them to undefined or null if not required by JobInsert type.
    id: undefined, // Let Drizzle handle default
    created_at: undefined, // Let Drizzle handle default
    status: JobStatus.queued, // Default status for new jobs
  };
};

export const jobFromAreaFactory =
  (command: CrawlCommand, previousJob: { accountId: string; id: string }) =>
  async (area: AreaInformation) => // Make inner function async
    await newJob(previousJob.accountId, command, previousJob.id, area.fullPath);

export const prepareNewArea = (provider: TokenProvider, type: AreaType, area: AreaInformation) => {
  return {
    provider,
    full_path: area.fullPath,
    gitlab_id: area.id,
    name: area.name,
    type: type
  };
};

export const prepareNewAreas = (
  provider: TokenProvider,
  type: AreaType,
  areas: AreaInformation[]
) => {
  return areas.map((area) => prepareNewArea(provider, type, area));
};

export const ensureAreasExist = async (
  provider: TokenProvider,
  scopes: AuthorizationScopesResult
) => {
  await db
    .insert(area)
    .values([
      ...prepareNewAreas(provider, AreaType.group, scopes.groups),
      ...prepareNewAreas(provider, AreaType.project, scopes.projects)
    ])
    .onConflictDoNothing();
  return [
    ...new Set([...scopes.groups.map((x) => x.fullPath), ...scopes.projects.map((x) => x.fullPath)])
  ];
};

/**
 * Prepares only global jobs after scoping. Area-specific jobs are handled by `handleNewArea`.
 */
export const prepareGlobalJobsAfterScoping = async (
  previousJob: { accountId: string; id: string }
  // groups and projects parameters are no longer needed here
): Promise<JobInsert[]> => {
  // Prepare new global Jobs...
  const newJobPromises = [];
  // For Users
  newJobPromises.push(newJob(previousJob.accountId, CrawlCommand.users, previousJob.id));
  // For Vulnerabilities
  newJobPromises.push(newJob(previousJob.accountId, CrawlCommand.vulnerabilities, previousJob.id));
  // For Timelogs
  newJobPromises.push(newJob(previousJob.accountId, CrawlCommand.timelogs, previousJob.id));

  return Promise.all(newJobPromises);
};

const checkJobOperationResults = (jobs: any[], result: ResultSet, action: "update" | "insert") => {
  // Check that all new Jobs are actually inserted
  if (result.rowsAffected < jobs.length) {
    handleIncident("Could not {action} Jobs!", jobs, action);
  }
};

export const handleIncident = (message: string, mainData: any, ...context: any[]) => {
  const incidentID = ulid();
  logger.error(`\nINCIDENT {incidentID}\n\t${message}`, { ...context, mainData, incidentID });
  Bun.write(
    path.join("logs", "incidents", `${incidentID}.data`),
    `${message}\n${Bun.inspect(context)}\n\n${Bun.inspect(mainData)}`
  );
};

export const ensureJobSync = async (inserts: JobInsert[], resetJobIDs: string[]) => {
  // 5: If we need to insert new jobs
  if (inserts.length > 0) {
    // do so and check the results
    await db.insert(job).values(inserts).onConflictDoNothing();
    /*
    checkJobOperationResults(
      inserts,
      await db.insert(job).values(inserts).onConflictDoNothing(),
      "insert")
    */
  }

  // 6: If we need to update some jobs
  if (resetJobIDs.length > 0) {
    // do so and check the result again
    checkJobOperationResults(
      resetJobIDs,
      await db
        .update(job)
        .set({
          status: JobStatus.queued,
          started_at: null,
          finished_at: null
        })
        .where(inArray(job.id, resetJobIDs)),
      "update"
    );
  }
};

export type ExistingJobLookup = {
  [provider in TokenProvider]: {
    // or full_path.command
    [key: string]: {
      [subkey in CrawlCommand]?: {
        id: string;
        status: JobStatus;
      };
    };
  };
};

export const prepareJobInsertsAndResets = (
  newJobs: any[],
  existingJobs: ExistingJobLookup,
  provider?: TokenProvider
) => {
  // 4: Only to now filter all potential new Jobs into those we need to update...
  const updateJobs = [] as string[];
  // 4.1: ... and those we need to insert
  const insertJobs = newJobs.filter((x) => {
    if (
      !x.command ||
      x.command.length <= 0 ||
      (!provider && (!x.provider || x.provider.length <= 0))
    )
      return false;

    const providerJobs: ExistingJobLookup[keyof ExistingJobLookup] =
      existingJobs[(x.provider as TokenProvider) ?? provider];
    const jobsLookup =
      !!x.full_path && x.full_path.length > 0 ? providerJobs?.[x.full_path] : providerJobs?.[""]; // Add optional chaining for providerJobs
    const jobInfo = jobsLookup?.[x.command as CrawlCommand]; // Use optional chaining here
    // If the key does not exist, it's truly a new job and gets inserted
    if (!jobInfo) return true;

    // If the key for this job exists and is an actual value...
    // we can only make use if the job has failed before...
    if (jobInfo.status === JobStatus.failed) {
      // ... and reset its status
      updateJobs.push(jobInfo.id);
    }
    // anyway, we will discard it as a new job.
    return false;
  });

  return {
    inserts: insertJobs,
    resets: updateJobs
  };
};

export const spawnNewJobs = async (
  provider: TokenProvider,
  scopes: AuthorizationScopesResult,
  currentJob: { accountId: string; id: string }
) => {
  try {
    // 1: Insert areas (groups, projects), if they do not already exist.
    //    `ensureAreasExist` also returns a list of all fullPaths for these areas.
    await ensureAreasExist(provider, scopes);

    // 2: For each newly discovered group and project, call handleNewArea to create the comprehensive job suite.
    //    The `currentJob.id` is passed as the `spawningJobId`.
    logger.info(`Spawning comprehensive jobs for ${scopes.groups.length} groups and ${scopes.projects.length} projects from job ${currentJob.id}`);
    for (const group of scopes.groups) {
      await handleNewArea(group.fullPath, AreaType.group, String(group.id), currentJob.accountId, currentJob.id);
    }
    for (const project of scopes.projects) {
      await handleNewArea(project.fullPath, AreaType.project, String(project.id), currentJob.accountId, currentJob.id);
    }

    // 3: Prepare and sync global jobs (users, vulnerabilities, timelogs).
    //    Fetch existing global jobs (no full_path) to avoid duplicates or to reset failed ones.
    //    Note: `jobSearch` with an empty fullPaths array might need adjustment if it doesn't handle global jobs correctly.
    //    For now, we assume `jobSearch(provider, [])` or a similar call can fetch global jobs for the provider.
    //    A more robust way would be to fetch jobs with `full_path IS NULL` for the given account.
    //    Let's assume `jobSearch` with an empty array is okay for now, or `toJobLookup` handles empty `full_path` keys.
    const existingGlobalJobsLookup = toJobLookup(await jobSearch(provider, [])); // Fetch global jobs

    const newGlobalJobs = await prepareGlobalJobsAfterScoping(currentJob);

    // Filter these global jobs into those to insert and those to reset.
    // The `provider` parameter in `prepareJobInsertsAndResets` will be used as these jobs don't have `full_path`.
    const preparedGlobalJobs = prepareJobInsertsAndResets(newGlobalJobs, existingGlobalJobsLookup, provider);

    // Sync global jobs to the DB.
    await ensureJobSync(preparedGlobalJobs.inserts, preparedGlobalJobs.resets);
    logger.info(`Global jobs synced: ${preparedGlobalJobs.inserts.length} inserts, ${preparedGlobalJobs.resets.length} resets for job ${currentJob.id}`);

  } catch (error: any) {
    handleIncident("Could not create/spawn new jobs after scoping!", { currentJob, scopes, error }, error);
  }
};

export const getAccounts = async (userId: string) => {
  return await db
    .selectDistinct({
      id: account.id,
      provider: account.providerId,
      token: account.accessToken,
      refreshToken: account.refreshToken
    })
    .from(account)
    .where(eq(account.userId, userId));
};

export const isResettable = (obj: Partial<JobType>) => {
  return !obj.status || obj.status !== JobStatus.failed;
};

export async function scopingJobsFromAccounts(
  accounts: Awaited<ReturnType<typeof getAccounts>>,
  userId: string
): Promise<void>;
export async function scopingJobsFromAccounts(
  accounts: Awaited<ReturnType<typeof getAccounts>>,
  existingJobs: ExistingJobLookup
): Promise<void>;
export async function scopingJobsFromAccounts(
  accounts: Awaited<ReturnType<typeof getAccounts>>,
  existingJobs: ExistingJobLookup | string
): Promise<void> {
  if (typeof existingJobs === "string") existingJobs = toJobLookup(await jobSearch(existingJobs));

  const mappedJobPromises = accounts.map(async (x) => { // map to promises
    const providerKey = x.provider as TokenProvider;
    const accountSpecificJobs = existingJobs[providerKey];
    // For authorizationScope jobs, there's no full_path, so we check the root of accountSpecificJobs
    // or a specific convention if one exists for global jobs in ExistingJobLookup.
    // Assuming global/account-level jobs might be under an empty string key or similar.
    // For an `authorizationScope` job, it's typically unique per accountId and command.
    // The `ExistingJobLookup` structure is `[provider][full_path_or_empty][command]`.
    // For `authorizationScope`, `full_path` is usually null/empty.
    const jobInfoForAuthScope = accountSpecificJobs?.[""]?.[CrawlCommand.authorizationScope];

    if (jobInfoForAuthScope) {
      if (!isResettable(jobInfoForAuthScope)) return undefined; // Cannot reset (e.g., still running)
      return jobInfoForAuthScope.id as string; // ID of job to reset
    } else {
      return newJob(x.id, CrawlCommand.authorizationScope); // Create new job
    }
  });

  const resolvedMappedObjs = await Promise.all(mappedJobPromises); // Await all promises

  const scopingJobs = resolvedMappedObjs.reduce(
    (z, x) => {
      if (x === undefined) return z; // Explicitly check for undefined
      if (typeof x === "string") {
        z.updates.push(x);
      } else {
        z.inserts.push(x);
      }
      return z;
    },
    { inserts: [] as JobInsert[], updates: [] as string[] }
  );
  await ensureJobSync(scopingJobs.inserts, scopingJobs.updates);
}

export const getAvailableJobs = async (
  status: JobStatus = JobStatus.queued,
  cursor: string | null = null,
  perPage: number = 10
) => {
  perPage = Math.min(Math.max(perPage, 0), 50);
  const filter = [eq(job.status, status)];
  if (cursor) {
    filter.push(gt(job.id, cursor));
  }
  const jobResults = (
    await db.query.job.findMany({
      columns: {
        id: true,
        status: true,
        command: true,
        full_path: true,
        branch: true,
        from: true,
        to: true,
        resumeState: true // Select the new resumeState field
      },
      with: {
        usingAccount: {
          columns: {
            providerId: true,
            accessToken: true,
            accessTokenExpiresAt: true,
            refreshToken: true,
            refreshTokenExpiresAt: true
          }
        }
      },
      where: (_, { and }) => and(...filter),
      orderBy: (table, { asc }) => asc(table.id),
      limit: perPage
    })
  ).map((x) => {
    // Ensure resumeState is parsed correctly (Drizzle might return it as string or buffer depending on driver)
    let parsedResumeState = null;
    if (x.resumeState) {
      try {
        // Assuming Drizzle returns a JSON object directly for blob({ mode: 'json' })
        parsedResumeState =
          typeof x.resumeState === "string" ? JSON.parse(x.resumeState) : x.resumeState;
      } catch (e) {
        logger.error("Failed to parse resumeState for job {jobId}", { jobId: x.id, error: e });
        // Keep it null if parsing fails
      }
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { usingAccount, full_path, command, resumeState, ...rest } = x; // Destructure resumeState
    const { providerId, ...accountRest } = usingAccount;
    return {
      ...rest,
      command: command as CrawlCommand,
      fullPath: full_path,
      ...accountRest,
      baseURL: providerToBaseURL(providerId),
      provider: providerId as TokenProvider,
      resumeState: parsedResumeState // Add resumeState to the returned object
    };
  });
  return jobResults;
};

/**
 * Updates the resume state for a specific job.
 * @param jobId The ID of the job to update.
 * @param newState The new resume state object (or null to clear it).
 */
export async function updateJobResumeState(
  jobId: string,
  newState: Record<string, any> | null
): Promise<ResultSet> {
  logger.debug("Updating resume state for job {jobId}", { jobId, newState });
  try {
    const result = await db
      .update(job)
      .set({
        resumeState: newState // Drizzle should handle JSON serialization for blob({ mode: 'json' })
      })
      .where(eq(job.id, jobId));
    if (result.rowsAffected === 0) {
      logger.warn("Attempted to update resume state for non-existent job {jobId}", { jobId });
    }
    return result;
  } catch (error) {
    logger.error("Failed to update resume state for job {jobId}: {error}", { jobId, error });
    throw error; // Re-throw the error after logging
  }
}

export const providerToBaseURL = (provider: TokenProvider | string) => {
  switch (provider.toLowerCase()) {
    case "gitlab-onprem":
    case "gitlabonprem":
      return AppSettings().auth.providers.gitlab.baseUrl;
    case "gitlab":
    case "gitlabcloud":
    case "gitlab-cloud":
      return AppSettings().auth.providers.gitlabCloud.baseUrl;
    case "jira":
      return AppSettings().auth.providers.jira.baseUrl;
    case "jiracloud":
      return AppSettings().auth.providers.jiracloud.baseUrl;
    default:
      logger.warn("No base URL found for provider {provider}", { provider });
      return null;
  }
};
