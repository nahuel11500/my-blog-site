// The CV, written once: /cv/ renders it as a page, /cv.pdf as a PDF.
//
// Public on purpose, so it carries nothing personal: no email, no phone, no
// address, no photo. The only ways to reach me are the links already on every
// page of this site.
//
// No company figures either (fleet size, team counts, internal volumes): only
// percentages and ratios, which show the outcome without describing the company.
//
// Text takes two marks: **bold** and [label](https://url).

export interface Role {
	title: string;
	company: string;
	location: string;
	period: string;
	bullets: string[];
}

export interface School {
	name: string;
	degree: string;
	location: string;
	period: string;
	bullets: string[];
}

export interface SkillGroup {
	label: string;
	items: string[];
}

export const cv = {
	name: 'Nahuel Canavy',
	tagline: 'Building scalable infrastructure and platforms for AI and software teams.',
	links: [
		{ label: 'nahuelcanavy.com', href: 'https://nahuelcanavy.com' },
		{ label: 'linkedin.com/in/nahuel-canavy-159109234', href: 'https://www.linkedin.com/in/nahuel-canavy-159109234/' },
		{ label: 'github.com/nahuel11500', href: 'https://github.com/nahuel11500' },
	],
	experience: [
		{
			title: 'Platform Engineer',
			company: 'Wiremind',
			location: 'Paris, France',
			period: 'January 2025 – Present',
			bullets: [
				'**Led the exit from Google Cloud** to OVHcloud bare metal: migrated the data-science stack (JupyterHub, Argo Workflows, MLflow, MinIO, PostgreSQL databases, now replicated) and decommissioned GKE. GPU costs fell 20%.',
				'**Freed 14% of requested CPU** across the fleet, room to grow without buying servers: Vertical Pod Autoscaler everywhere and new resource defaults in the templating engine.',
				'**Restored full disk speed on part of the server fleet**: traced a 5× slowdown to a leftover system configuration and removed it, cutting kernel CPU by 43% ([write-up](/blog/audit_rules_disk_throughput/)).',
				'**Introduced ClickHouse** for analytics, with the data-engineering team: 66% less disk, 27% less CPU, 28% less memory. Ran it on the Altinity operator, highly available and backed up.',
				'**Built the FinOps pipeline** behind monthly cost reports per team and per client, from OVHcloud and AWS invoices and Thanos usage data, with budgets tracked against actuals.',
				"**Created the internal AI agent platform**, adopted by other teams, plus my team's own agents on it: L1 support, daily error reports, dependency-update triage, post-deploy regression checks.",
				'**Put AWS storage and access in code**: S3 buckets and IAM policies declared as Kubernetes resources, so a backup bucket ships in the same release as the database it serves.',
				'**Moved a product line from Helmfile to ArgoCD**, platform side, in two weeks and with no production incident.',
				'**Secured the container supply chain**: every deployed image pinned to its digest, and scanned for vulnerabilities in CI and on every cluster with Trivy.',
				'Built developer tooling: an MCP server that lets coding agents create and delete review environments, and contributions to the cluster-operations CLI.',
				"**Moved the company's Grafana dashboards into Git**: one folder per team, synced to every Grafana through a CI gate, with no broken link.",
				"**Shared maintenance of the company's entire production infrastructure**, at every layer from servers and clusters to databases and monitoring, including as incident lead.",
				"**Taught Kubernetes and ArgoCD to the company's developers** through internal workshops, run several times.",
			],
		},
		{
			title: 'DevOps Engineer, Internship',
			company: 'Thales Alenia Space',
			location: 'Toulouse, France',
			period: 'April 2024 – September 2024',
			bullets: [
				'Designed and industrialised an automated migration tool that moved CI/CD pipelines from Jenkins to GitLab.',
			],
		},
	] satisfies Role[],
	education: [
		{
			name: 'IMT Atlantique',
			degree: 'Engineering degree, Software Engineering',
			location: 'Brest, then Nantes',
			period: '2021 – 2024',
			bullets: [
				'Exchange program at the University of California, San Diego (2023), Computer Graphics & Systems.',
			],
		},
	] satisfies School[],
	skills: [
		{ label: 'Certifications', items: ['**CKA**', '**KCNA**'] },
		{ label: 'Orchestration', items: ['**Kubernetes**', 'Helm', 'helmfile', 'ArgoCD', 'kubespray', 'Cluster API', 'VPA', 'Cilium'] },
		{ label: 'Languages & scripting', items: ['**Python**', '**Go**', 'Rust', 'Bash'] },
		{ label: 'Cloud & infrastructure', items: ['**OVHcloud**', 'AWS', 'OpenStack', 'bare metal', 'GPU', 'Terraform', 'Linux', 'GitLab CI', 'Trivy'] },
		{ label: 'Data & messaging', items: ['**ClickHouse**', 'PostgreSQL / Patroni', 'Elasticsearch', 'Redis', 'RabbitMQ', 'S3'] },
		{ label: 'Observability', items: ['**Prometheus**', 'Thanos', 'Grafana', 'Alertmanager', 'incident.io'] },
		{ label: 'Spoken languages', items: ['**French** (native)', 'English (bilingual)', 'Spanish (fluent)'] },
	] satisfies SkillGroup[],
	projects: [
		'**foundry** (Go, 2026): CLI that runs my engineering workflow through coding agents, from design and tickets to implementation and review.',
		'**[recouvrance](https://nahuelcanavy.com/recouvrance/)** (Rust, 2026): Kubernetes desktop client with a local MCP server that sets what AI agents may do on a cluster.',
	],
};

export interface Segment {
	text: string;
	bold: boolean;
	href?: string;
}

const MARK = /\*\*(.+?)\*\*|\[([^\]]+)\]\(([^)]+)\)/g;

/** Splits text on **bold** and [label](url), which may nest: **[label](url)**. */
export function parse(text: string, bold = false): Segment[] {
	const out: Segment[] = [];
	let last = 0;

	for (const m of text.matchAll(MARK)) {
		if (m.index > last) out.push({ text: text.slice(last, m.index), bold });
		if (m[1] !== undefined) out.push(...parse(m[1], true));
		else out.push({ text: m[2], bold, href: m[3] });
		last = m.index + m[0].length;
	}

	if (last < text.length) out.push({ text: text.slice(last), bold });
	return out;
}
