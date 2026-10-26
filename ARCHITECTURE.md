# Architecture Summary

THANDANAZI Workforce is a private single-company serverless PWA.

## DynamoDB schema

Single table:
- PK + SK primary key
- GSI_WorkerDate for worker shift history
- GSI_SiteDate for site shift history
- GSI_Payroll for payroll export by site/date
- GSI_Status for active shifts and open ops records
- GSI_ConnectionsByRole for WebSocket supervisor/worker fanout

Entity keys:
- EMP#employeeNumber / PROFILE#employeeNumber
- SHIFT#shiftId / META#shiftId
- FUEL#requestId / META#requestId
- BREAKDOWN#breakdownId / META#breakdownId
- EMERGENCY#emergencyId / META#emergencyId
- TASK#taskId / META#taskId
- CONNECTION#connectionId / META#connectionId
- PENDING#employeeNumber / UPDATE#updateId

## API route map

Worker:
- POST /auth/first-time-password
- GET /me
- GET /sites
- GET /sites/{siteId}/machines
- GET /checklists
- POST /shifts/clock-in
- POST /shifts/clock-out
- GET /shifts/active
- POST /ops/fuel
- POST /ops/breakdown
- POST /ops/emergency
- GET /tasks
- PATCH /tasks/{taskId}/read
- PATCH /tasks/{taskId}/complete
- POST /sync

Supervisor:
- GET /supervisor/overview
- GET /supervisor/active-shifts
- GET /supervisor/shifts
- GET /supervisor/ops
- PATCH /supervisor/ops/{id}/status
- POST /supervisor/tasks
- POST /supervisor/payroll/export

## WebSocket events

- TASK_ASSIGNED
- EMERGENCY_CREATED
- FUEL_REQUEST_CREATED
- BREAKDOWN_CREATED
- SHIFT_STARTED
- SHIFT_ENDED
- CERTIFICATE_UPDATED

## Build order implemented

1. Architecture summary
2. DynamoDB schema
3. API route map
4. WebSocket event map
5. Frontend screen structure
6. Backend folder structure
7. AWS SAM template
8. Shared TypeScript types
9. Auth placeholder and role flow
10. Worker dashboard
11. Clock-in flow
12. Active shift screen
13. Clock-out flow
14. Operations page
15. Supervisor dashboard
16. Ad hoc task system
17. Offline queue
18. Payroll export
19. Deployment instructions
