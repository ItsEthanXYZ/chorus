// Service management functions
// Handles registration and configuration of documentation services

import { mutation, query, action } from "./_generated/server";
import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import type { ServiceConfig } from "./lib/types";

/**
 * Register a new service for documentation tracking
 */
export const registerService = mutation({
  args: {
    name: v.string(),
    displayName: v.string(),
    libraryName: v.string(),
    currentVersion: v.string(),
    docsBaseUrl: v.string(),
    crawlPatterns: v.array(v.string()),
    excludePatterns: v.optional(v.array(v.string())),
    versionCheckUrl: v.optional(v.string()),
    versionCheckMethod: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Check if service already exists
    const existing = await ctx.db
      .query("services")
      .withIndex("by_name", (q) => q.eq("name", args.name))
      .first();

    if (existing) {
      throw new Error(`Service "${args.name}" already exists`);
    }

    // Insert new service
    const serviceId = await ctx.db.insert("services", {
      name: args.name,
      displayName: args.displayName,
      libraryName: args.libraryName,
      currentVersion: args.currentVersion,
      docsBaseUrl: args.docsBaseUrl,
      lastChecked: Date.now(),
      lastUpdated: Date.now(),
      config: {
        crawlPatterns: args.crawlPatterns,
        excludePatterns: args.excludePatterns,
        versionCheckUrl: args.versionCheckUrl,
        versionCheckMethod: args.versionCheckMethod,
      },
    });

    return serviceId;
  },
});

/**
 * Update service configuration
 */
export const updateService = mutation({
  args: {
    serviceId: v.id("services"),
    displayName: v.optional(v.string()),
    currentVersion: v.optional(v.string()),
    docsBaseUrl: v.optional(v.string()),
    crawlPatterns: v.optional(v.array(v.string())),
    excludePatterns: v.optional(v.array(v.string())),
    versionCheckUrl: v.optional(v.string()),
    versionCheckMethod: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { serviceId, ...updates } = args;

    const service = await ctx.db.get(serviceId);
    if (!service) {
      throw new Error("Service not found");
    }

    // Prepare update object
    const updateObj: any = {};

    if (updates.displayName) updateObj.displayName = updates.displayName;
    if (updates.currentVersion) updateObj.currentVersion = updates.currentVersion;
    if (updates.docsBaseUrl) updateObj.docsBaseUrl = updates.docsBaseUrl;

    // Update config if any config fields are provided
    if (
      updates.crawlPatterns ||
      updates.excludePatterns ||
      updates.versionCheckUrl ||
      updates.versionCheckMethod
    ) {
      updateObj.config = {
        ...service.config,
        ...(updates.crawlPatterns && { crawlPatterns: updates.crawlPatterns }),
        ...(updates.excludePatterns && { excludePatterns: updates.excludePatterns }),
        ...(updates.versionCheckUrl && { versionCheckUrl: updates.versionCheckUrl }),
        ...(updates.versionCheckMethod && {
          versionCheckMethod: updates.versionCheckMethod,
        }),
      };
    }

    await ctx.db.patch(serviceId, updateObj);

    return serviceId;
  },
});

/**
 * Get all registered services
 */
export const listServices = query({
  handler: async (ctx) => {
    return await ctx.db.query("services").collect();
  },
});

/**
 * Get a specific service by name
 */
export const getService = query({
  args: { name: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("services")
      .withIndex("by_name", (q) => q.eq("name", args.name))
      .first();
  },
});

/**
 * Delete a service and all its documentation
 */
export const deleteService = mutation({
  args: { serviceId: v.id("services") },
  handler: async (ctx, args) => {
    const service = await ctx.db.get(args.serviceId);
    if (!service) {
      throw new Error("Service not found");
    }

    // Delete all documents for this service
    const documents = await ctx.db
      .query("documents")
      .withIndex("by_service", (q) => q.eq("service", service.name))
      .collect();

    const deletePromises = documents.map((doc) => ctx.db.delete(doc._id));
    await Promise.all(deletePromises);

    // Delete the service
    await ctx.db.delete(args.serviceId);

    return { deleted: true, documentsRemoved: documents.length };
  },
});

/**
 * Get statistics for a service
 */
export const getServiceStats = query({
  args: { serviceName: v.string() },
  handler: async (ctx, args) => {
    const documents = await ctx.db
      .query("documents")
      .withIndex("by_service", (q) => q.eq("service", args.serviceName))
      .collect();

    // Group by version
    const versionStats = documents.reduce((acc, doc) => {
      if (!acc[doc.version]) {
        acc[doc.version] = { count: 0, categories: new Set() };
      }
      acc[doc.version].count++;
      acc[doc.version].categories.add(doc.category);
      return acc;
    }, {} as Record<string, { count: number; categories: Set<string> }>);

    return {
      totalDocuments: documents.length,
      versions: Object.entries(versionStats).map(([version, stats]) => ({
        version,
        documentCount: stats.count,
        categories: Array.from(stats.categories),
      })),
    };
  },
});

/**
 * Get services that need version checking
 */
export const getServicesNeedingCheck = query({
  args: {
    maxAge: v.optional(v.number()), // Max age in milliseconds (default 24 hours)
  },
  handler: async (ctx, args) => {
    const maxAge = args.maxAge || 24 * 60 * 60 * 1000; // 24 hours
    const cutoff = Date.now() - maxAge;

    const services = await ctx.db
      .query("services")
      .withIndex("by_last_checked")
      .filter((q) => q.lt(q.field("lastChecked"), cutoff))
      .collect();

    return services;
  },
});
