/* eslint-disable */
import * as types from './graphql';
import type { TypedDocumentNode as DocumentNode } from '@graphql-typed-document-node/core';

/**
 * Map of all GraphQL operations in the project.
 *
 * This map has several performance disadvantages:
 * 1. It is not tree-shakeable, so it will include all operations in the project.
 * 2. It is not minifiable, so the string of a GraphQL query will be multiple times inside the bundle.
 * 3. It does not support dead code elimination, so it will add unused operations.
 *
 * Therefore it is highly recommended to use the babel or swc plugin for production.
 * Learn more about it here: https://the-guild.dev/graphql/codegen/plugins/presets/preset-client#reducing-bundle-size
 */
type Documents = {
    "\n  subscription NotificationAdded {\n    notificationAdded {\n      id\n      message\n    }\n  }\n": typeof types.NotificationAddedDocument,
    "\n  query Assets {\n    assets {\n      id\n      kind\n      name\n      tasks {\n        id\n        title\n        everyKm\n        everyMonths\n        due {\n          dueAt\n          dueKm\n          reason\n        }\n      }\n      renewals {\n        id\n        kind\n        title\n        expiresAt\n      }\n      readings {\n        id\n        at\n        value\n      }\n      usage {\n        perDay\n        monthlyBill {\n          kwh\n          total\n          currency\n          bandIndex\n        }\n      }\n    }\n  }\n": typeof types.AssetsDocument,
    "\n  query DueSoon($withinDays: Int!) {\n    dueSoon(withinDays: $withinDays) {\n      subjectType\n      subjectId\n      title\n      dueAt\n      dueKm\n      reason\n      asset {\n        id\n        name\n        kind\n      }\n    }\n  }\n": typeof types.DueSoonDocument,
    "\n  mutation CompleteTask($input: CompleteTaskInput!) {\n    completeTask(input: $input) {\n      id\n      lastDoneAt\n    }\n  }\n": typeof types.CompleteTaskDocument,
    "\n  query AssetNames {\n    assets {\n      id\n      name\n      kind\n    }\n  }\n": typeof types.AssetNamesDocument,
    "\n  mutation RegisterAsset($input: RegisterAssetInput!) {\n    registerAsset(input: $input) {\n      id\n    }\n  }\n": typeof types.RegisterAssetDocument,
    "\n  mutation AddTask($input: AddTaskInput!) {\n    addTask(input: $input) {\n      id\n    }\n  }\n": typeof types.AddTaskDocument,
    "\n  mutation RecordReading($input: RecordReadingInput!) {\n    recordReading(input: $input) {\n      id\n    }\n  }\n": typeof types.RecordReadingDocument,
    "\n  mutation AddRenewal($input: AddRenewalInput!) {\n    addRenewal(input: $input) {\n      id\n    }\n  }\n": typeof types.AddRenewalDocument,
    "\n  query Notifications {\n    notifications(limit: 15) {\n      id\n      reminderId\n      title\n      message\n      createdAt\n      readAt\n    }\n  }\n": typeof types.NotificationsDocument,
    "\n  mutation MarkRead($id: ID!) {\n    markNotificationRead(id: $id) {\n      id\n      readAt\n    }\n  }\n": typeof types.MarkReadDocument,
    "\n  mutation Snooze($id: ID!, $hours: Float!) {\n    snoozeReminder(id: $id, hours: $hours) {\n      id\n      fireAt\n    }\n  }\n": typeof types.SnoozeDocument,
};
const documents: Documents = {
    "\n  subscription NotificationAdded {\n    notificationAdded {\n      id\n      message\n    }\n  }\n": types.NotificationAddedDocument,
    "\n  query Assets {\n    assets {\n      id\n      kind\n      name\n      tasks {\n        id\n        title\n        everyKm\n        everyMonths\n        due {\n          dueAt\n          dueKm\n          reason\n        }\n      }\n      renewals {\n        id\n        kind\n        title\n        expiresAt\n      }\n      readings {\n        id\n        at\n        value\n      }\n      usage {\n        perDay\n        monthlyBill {\n          kwh\n          total\n          currency\n          bandIndex\n        }\n      }\n    }\n  }\n": types.AssetsDocument,
    "\n  query DueSoon($withinDays: Int!) {\n    dueSoon(withinDays: $withinDays) {\n      subjectType\n      subjectId\n      title\n      dueAt\n      dueKm\n      reason\n      asset {\n        id\n        name\n        kind\n      }\n    }\n  }\n": types.DueSoonDocument,
    "\n  mutation CompleteTask($input: CompleteTaskInput!) {\n    completeTask(input: $input) {\n      id\n      lastDoneAt\n    }\n  }\n": types.CompleteTaskDocument,
    "\n  query AssetNames {\n    assets {\n      id\n      name\n      kind\n    }\n  }\n": types.AssetNamesDocument,
    "\n  mutation RegisterAsset($input: RegisterAssetInput!) {\n    registerAsset(input: $input) {\n      id\n    }\n  }\n": types.RegisterAssetDocument,
    "\n  mutation AddTask($input: AddTaskInput!) {\n    addTask(input: $input) {\n      id\n    }\n  }\n": types.AddTaskDocument,
    "\n  mutation RecordReading($input: RecordReadingInput!) {\n    recordReading(input: $input) {\n      id\n    }\n  }\n": types.RecordReadingDocument,
    "\n  mutation AddRenewal($input: AddRenewalInput!) {\n    addRenewal(input: $input) {\n      id\n    }\n  }\n": types.AddRenewalDocument,
    "\n  query Notifications {\n    notifications(limit: 15) {\n      id\n      reminderId\n      title\n      message\n      createdAt\n      readAt\n    }\n  }\n": types.NotificationsDocument,
    "\n  mutation MarkRead($id: ID!) {\n    markNotificationRead(id: $id) {\n      id\n      readAt\n    }\n  }\n": types.MarkReadDocument,
    "\n  mutation Snooze($id: ID!, $hours: Float!) {\n    snoozeReminder(id: $id, hours: $hours) {\n      id\n      fireAt\n    }\n  }\n": types.SnoozeDocument,
};

/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 *
 *
 * @example
 * ```ts
 * const query = graphql(`query GetUser($id: ID!) { user(id: $id) { name } }`);
 * ```
 *
 * The query argument is unknown!
 * Please regenerate the types.
 */
export function graphql(source: string): unknown;

/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  subscription NotificationAdded {\n    notificationAdded {\n      id\n      message\n    }\n  }\n"): (typeof documents)["\n  subscription NotificationAdded {\n    notificationAdded {\n      id\n      message\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  query Assets {\n    assets {\n      id\n      kind\n      name\n      tasks {\n        id\n        title\n        everyKm\n        everyMonths\n        due {\n          dueAt\n          dueKm\n          reason\n        }\n      }\n      renewals {\n        id\n        kind\n        title\n        expiresAt\n      }\n      readings {\n        id\n        at\n        value\n      }\n      usage {\n        perDay\n        monthlyBill {\n          kwh\n          total\n          currency\n          bandIndex\n        }\n      }\n    }\n  }\n"): (typeof documents)["\n  query Assets {\n    assets {\n      id\n      kind\n      name\n      tasks {\n        id\n        title\n        everyKm\n        everyMonths\n        due {\n          dueAt\n          dueKm\n          reason\n        }\n      }\n      renewals {\n        id\n        kind\n        title\n        expiresAt\n      }\n      readings {\n        id\n        at\n        value\n      }\n      usage {\n        perDay\n        monthlyBill {\n          kwh\n          total\n          currency\n          bandIndex\n        }\n      }\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  query DueSoon($withinDays: Int!) {\n    dueSoon(withinDays: $withinDays) {\n      subjectType\n      subjectId\n      title\n      dueAt\n      dueKm\n      reason\n      asset {\n        id\n        name\n        kind\n      }\n    }\n  }\n"): (typeof documents)["\n  query DueSoon($withinDays: Int!) {\n    dueSoon(withinDays: $withinDays) {\n      subjectType\n      subjectId\n      title\n      dueAt\n      dueKm\n      reason\n      asset {\n        id\n        name\n        kind\n      }\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation CompleteTask($input: CompleteTaskInput!) {\n    completeTask(input: $input) {\n      id\n      lastDoneAt\n    }\n  }\n"): (typeof documents)["\n  mutation CompleteTask($input: CompleteTaskInput!) {\n    completeTask(input: $input) {\n      id\n      lastDoneAt\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  query AssetNames {\n    assets {\n      id\n      name\n      kind\n    }\n  }\n"): (typeof documents)["\n  query AssetNames {\n    assets {\n      id\n      name\n      kind\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation RegisterAsset($input: RegisterAssetInput!) {\n    registerAsset(input: $input) {\n      id\n    }\n  }\n"): (typeof documents)["\n  mutation RegisterAsset($input: RegisterAssetInput!) {\n    registerAsset(input: $input) {\n      id\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation AddTask($input: AddTaskInput!) {\n    addTask(input: $input) {\n      id\n    }\n  }\n"): (typeof documents)["\n  mutation AddTask($input: AddTaskInput!) {\n    addTask(input: $input) {\n      id\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation RecordReading($input: RecordReadingInput!) {\n    recordReading(input: $input) {\n      id\n    }\n  }\n"): (typeof documents)["\n  mutation RecordReading($input: RecordReadingInput!) {\n    recordReading(input: $input) {\n      id\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation AddRenewal($input: AddRenewalInput!) {\n    addRenewal(input: $input) {\n      id\n    }\n  }\n"): (typeof documents)["\n  mutation AddRenewal($input: AddRenewalInput!) {\n    addRenewal(input: $input) {\n      id\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  query Notifications {\n    notifications(limit: 15) {\n      id\n      reminderId\n      title\n      message\n      createdAt\n      readAt\n    }\n  }\n"): (typeof documents)["\n  query Notifications {\n    notifications(limit: 15) {\n      id\n      reminderId\n      title\n      message\n      createdAt\n      readAt\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation MarkRead($id: ID!) {\n    markNotificationRead(id: $id) {\n      id\n      readAt\n    }\n  }\n"): (typeof documents)["\n  mutation MarkRead($id: ID!) {\n    markNotificationRead(id: $id) {\n      id\n      readAt\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation Snooze($id: ID!, $hours: Float!) {\n    snoozeReminder(id: $id, hours: $hours) {\n      id\n      fireAt\n    }\n  }\n"): (typeof documents)["\n  mutation Snooze($id: ID!, $hours: Float!) {\n    snoozeReminder(id: $id, hours: $hours) {\n      id\n      fireAt\n    }\n  }\n"];

export function graphql(source: string) {
  return (documents as any)[source] ?? {};
}

export type DocumentType<TDocumentNode extends DocumentNode<any, any>> = TDocumentNode extends DocumentNode<  infer TType,  any>  ? TType  : never;