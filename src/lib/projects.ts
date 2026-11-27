import { TOOLS } from './recouvrance';

export interface Project {
	name: string;
	href: string;
	repo: string;
	tags: string[];
	text: string;
}

export const projects: Project[] = [
	{
		name: 'Recouvrance',
		href: '/recouvrance/',
		repo: 'https://github.com/nahuel11500/recouvrance',
		tags: ['rust', `${TOOLS} MCP tools`, 'MIT / Apache-2.0'],
		text: 'A fast, native Kubernetes desktop client in Rust, with a local MCP server so AI agents work on your clusters under rules you set.',
	},
];
