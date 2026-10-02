---
date: 2026-07-30
summary: A research prototype for evidence-driven, verifier-guided AI agents that inspect cryptography challenge artifacts before attempting to solve them.
tags:
  - project
  - multi-agent
  - cryptography
  - ctf
  - langgraph
---

# [Project] Verifier-Guided Multi-AI-Agent RAG for Automated Cryptography Challenge Solving

This project explores how multiple AI agents could collaborate on cryptography CTF challenges without treating an LLM's first guess as evidence. The central idea is to separate artifact inspection, attack discovery, verification, solver construction, and execution into explicit stages with traceable handoffs.

The project is currently paused and archived as a research prototype. It is not a production solver, and it does not yet provide an end-to-end pipeline that automatically solves arbitrary cryptography challenges.

## Why I started this project

A cryptography challenge is rarely just a prompt. It may include nested archives, source code, ciphertexts, keys, transcripts, helper scripts, or a remote-service launcher. An AI model can suggest attacks quickly, but it can also skip files, confuse assumptions with observations, or begin writing an exploit before identifying the real challenge entry point.

I started this project to experiment with a more disciplined workflow:

```text
challenge artifacts
  -> artifact intake
  -> classification and retrieval
  -> attack hypotheses
  -> skeptic and verifier
  -> solver construction and execution
  -> flag validation and report
```

Each stage is intended to produce evidence that can be checked before the next stage continues.

## What is implemented today

### Parser Agent

The Parser Agent is the most complete part of the project. It inventories a challenge workspace, inspects and extracts artifacts, records observations, and produces a validated handoff for future agents.

Its current capabilities include:

- deterministic file inventory before the first model call;
- safe path and archive validation;
- optional skills for archive intake, entry-point analysis, and crypto artifact parsing;
- typed handoff output consisting of human-readable notes and a machine-readable manifest;
- context budgeting, observation offloading, repair paths, and run metrics; and
- approval modes for tool actions.

The Parser Agent only performs intake. It does not choose an attack, decrypt data, write a solver, contact a remote service, or validate a flag.

### Progressive skill runtime

The repository includes a small skill system that lets an agent load task-specific instructions only when they are useful. This keeps the initial context smaller and separates optional guidance from mandatory workflow rules.

### Docker cryptography workspace

There is also an independent Docker sandbox MVP for running tools in a stateful workspace. It provides a persistent shell session, resource limits, disabled networking by default, file transfer within the workspace, command tracing, and basic command policy checks.

This sandbox has not yet been integrated into a complete solver pipeline and should not be treated as an audited security boundary.

### Fixtures and historical runs

The repository contains sample challenge artifacts, parser outputs, manifests, and historical runs. These are useful for studying failure modes and comparing how different models inspect the same workspace, although they are not all golden test cases.

## What remains planned

The following parts exist as architecture or backlog rather than a finished runtime:

- challenge classification and RAG-based retrieval;
- attack-hypothesis generation and ranking;
- skeptic and verifier agents;
- automatic solver generation and execution;
- flag validation and report generation; and
- a fully integrated end-to-end workflow.

The main lesson from the prototype is that reliable agentic solving needs more than a strong prompt. It needs observable evidence, explicit state, bounded tools, typed contracts, deterministic validation, and a clear distinction between what the system has seen and what it merely suspects.

## Repository

The source code, detailed architecture notes, and archived development history are available on GitHub:

[Nhan-Laptop/Verifier-Guided-Multi-AI-Agent-RAG-for-Automated-Cryptography-Challenge-Solving](https://github.com/Nhan-Laptop/Verifier-Guided-Multi-AI-Agent-RAG-for-Automated-Cryptography-Challenge-Solving)

The project is intended only for authorized CTF challenges, labs, and research environments.
