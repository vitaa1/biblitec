# Biblitec

Sistema de gestão das girotecas da Prefeitura Municipal de Teresina, desenvolvido pelo Núcleo de Tecnologia Educacional (NTHE) como parte do projeto **Giratech**.

## Stack

- **Next.js 15** (App Router) + TypeScript
- **PostgreSQL** + Drizzle ORM
- **Tailwind CSS** + shadcn/ui
- **Jest** para testes de integração
- **Docker Compose** para infra local

## Como rodar

Requisitos: Node.js 20+, Docker.

```bash
git clone https://github.com/vitaa1/biblitec.git
cd biblitec
cp .env.example .env.development
npm install
npm run services:up
npm run db:migrate
npm run db:seed
npm run dev
```

Acesse em `http://localhost:3000`.

## Scripts

```bash
npm run dev          # inicia o servidor de desenvolvimento
npm run services:up  # sobe o Postgres via Docker
npm run db:migrate   # aplica migrations pendentes
npm run db:seed      # popula dados iniciais
npm run db:studio    # abre o Drizzle Studio
npm test             # roda os testes
```

## Roadmap

<!-- milestones e issues -->

## Licença

A definir.
