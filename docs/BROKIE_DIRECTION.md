# Brokie Direction

Authoritative control plane: https://brokie-command-center.vercel.app

Direction ID: b3381565-d29b-41cd-988a-949c8a3ab653

Use Brokie Command Center as the shared control plane for portfolio direction, project truth, agent routing, approvals, and operational history.

## Current Focus

Operate the shared Brain, preserve project work, and retire only verified-unused projects

## Agent Contract

Before each job and each write, authenticated agents must read GET /api/brain/context from Command Center. This file is a reference snapshot, not a second source of truth. If direction changes, fetch fresh context and re-evaluate pending approvals. Report results and history to the originating job.
