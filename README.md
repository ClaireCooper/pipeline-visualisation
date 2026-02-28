# Pipeline Visualisation

View and edit your pipeline as a dependency graph and Gantt chart.

## YAML format

Pipelines are described as a set of named workflows, each containing jobs. Jobs can declare dependencies on other jobs in the same workflow via `needs`, and can reference another workflow via `uses`.

```yaml
workflows:
  build-test-deploy:
    jobs:
      build:
        duration: 600
      test:
        duration: 100
      deploy:
        uses: deploy
        needs:
          - build
          - test
  deploy:
    jobs:
      deploy-a:
        duration: 100
      deploy-b:
        duration: 500
```

| Field       | Required | Description                                    |
| ----------- | -------- | ---------------------------------------------- |
| `workflows` | yes      | Map of workflow name to workflow definition    |
| `jobs`      | yes      | Map of job name to job definition              |
| `duration`  | no       | Job duration in seconds                        |
| `needs`     | no       | List of job names this job depends on          |
| `uses`      | no       | Name of another workflow this job delegates to |

## Prerequisites

- [Node.js](https://nodejs.org/) 24.x or later

## Install dependencies

```sh
npm install
```

## Test

```sh
npm test
```

## Build

```sh
npm run build
```

Output is written to `dist/`.

## Run

```sh
npm run dev
```

Opens a local dev server with hot reload. Navigate to the URL shown in the terminal (typically `http://localhost:5173`).
