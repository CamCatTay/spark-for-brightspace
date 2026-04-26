// Copyright (c) 2026 CamCatTay. All rights reserved.
// See LICENSE file for terms of use.

// Shared plain-object shapes used across the message boundary (after JSON serialization).
// The Course class in brightspace.ts is used during construction; these interfaces
// represent the serialized form that content.ts and components.ts work with.

export interface ItemShape {
    id: number;
    name: string;
    url?: string | null;
    due_date?: string | null;
    start_date?: string | null;
    completed: boolean;
}

export interface CourseShape {
    id: number;
    name: string;
    url: string;
    quizzes: Record<string, ItemShape>;
    assignments: Record<string, ItemShape>;
    discussions: Record<string, ItemShape>;
}

export type CourseData = Record<string, CourseShape>;
