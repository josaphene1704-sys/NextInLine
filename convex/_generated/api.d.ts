/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as appointments from "../appointments.js";
import type * as auth from "../auth.js";
import type * as authHelpers from "../authHelpers.js";
import type * as barberHelpers from "../barberHelpers.js";
import type * as barbers from "../barbers.js";
import type * as businesses from "../businesses.js";
import type * as files from "../files.js";
import type * as gallery from "../gallery.js";
import type * as helpers from "../helpers.js";
import type * as migrations from "../migrations.js";
import type * as seed from "../seed.js";
import type * as services from "../services.js";
import type * as settings from "../settings.js";
import type * as specialSchedules from "../specialSchedules.js";
import type * as waitingList from "../waitingList.js";
import type * as whatsapp from "../whatsapp.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  appointments: typeof appointments;
  auth: typeof auth;
  authHelpers: typeof authHelpers;
  barberHelpers: typeof barberHelpers;
  barbers: typeof barbers;
  businesses: typeof businesses;
  files: typeof files;
  gallery: typeof gallery;
  helpers: typeof helpers;
  migrations: typeof migrations;
  seed: typeof seed;
  services: typeof services;
  settings: typeof settings;
  specialSchedules: typeof specialSchedules;
  waitingList: typeof waitingList;
  whatsapp: typeof whatsapp;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
