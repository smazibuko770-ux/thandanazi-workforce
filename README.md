# Thandanazi Workforce Management System

A full-stack workforce and field-operations management application designed for construction and mining environments.

This repository is a sanitised portfolio version of the project. All employee names, employee numbers, site information and operational data have been replaced with demonstration data.

## Project Overview

Thandanazi was built to digitise and simplify workforce operations that would otherwise rely heavily on manual paperwork, spreadsheets and WhatsApp communication.

The system supports workers, supervisors, administrators and mechanics through role-based workflows.

## Key Features

- Employee and role management
- Worker clock-in and clock-out workflows
- GPS capture for shift activity
- Mandatory meter-reading photo evidence
- Pre-start machine checklists
- Go / No-Go equipment checks
- Fuel request workflows
- Breakdown and maintenance reporting
- Emergency and incident reporting
- Supervisor and administration dashboards
- Mechanic fault-management workflow
- Attendance and shift records
- Payroll-hours exports
- Machine utilisation tracking
- Offline-first functionality
- Real-time notifications and updates
- Role-based access control

## Technology Stack

### Frontend
- React
- TypeScript
- Vite
- Tailwind CSS
- Progressive Web App architecture
- IndexedDB / offline synchronisation

### Backend
- Node.js
- TypeScript
- AWS Lambda
- Amazon API Gateway
- WebSockets

### AWS Infrastructure
- Amazon DynamoDB
- Amazon S3
- Amazon Cognito
- AWS Lambda
- API Gateway
- CloudFront
- AWS SAM

## AI-Assisted Development

AI tools were actively used during the development of Thandanazi as a development and problem-solving partner.

AI assisted with:

- architecture and workflow design
- breaking business requirements into technical tasks
- generating and refining code
- debugging application issues
- analysing errors and deployment failures
- designing AWS serverless infrastructure
- improving role-based workflows
- developing test scenarios
- identifying edge cases
- QA and regression testing
- documenting technical changes

AI-generated suggestions were not accepted blindly. Outputs were tested, reviewed and corrected before implementation.

This project strengthened my practical understanding of how AI can accelerate software development while still requiring human judgement, validation and ownership of the final solution.

## Business Problem

Field-based organisations often struggle with fragmented workforce information, manual attendance records, incomplete equipment checks and poor visibility of operational incidents.

Thandanazi brings these processes into one application, creating a digital record of workforce and equipment activity.

## Architecture

The application follows a serverless AWS architecture:

**React PWA → API Gateway → AWS Lambda → DynamoDB / S3**

Amazon Cognito handles authentication and role-based user access.

WebSocket functionality supports real-time operational updates.

See `ARCHITECTURE.md` for additional architecture information.

## Offline-First Design

Because construction and mining sites may have unreliable connectivity, the worker application was designed with offline operation in mind.

Local data can be temporarily stored on the device and synchronised when connectivity becomes available.

## Security & Privacy

This public repository contains demonstration data only.

Production credentials, environment variables, employee information, operational records and uploaded photographs are intentionally excluded.

Environment configuration is represented using `.env.example`.

## What I Learned

Building Thandanazi gave me practical experience in:

- translating operational requirements into software workflows
- AI-assisted software development
- full-stack application development
- AWS serverless architecture
- authentication and access control
- offline-first application design
- debugging and troubleshooting
- testing and QA
- deployment and infrastructure configuration
- iterative product improvement

## Author

**Sibongiseni Mazibuko**

Diploma in Computer Engineering
Cape Peninsula University of Technology

Focus areas: AI, automation, business process improvement, cloud technology and software development.
