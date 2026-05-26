// @ts-check
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';

// https://astro.build/config
export default defineConfig({
	integrations: [
		starlight({
			title: '老九的博客-',
			description: '财务流程、常用工具、软件入口和个人记录。',
			defaultLocale: 'root',
			locales: {
				root: {
					label: '简体中文',
					lang: 'zh-CN',
				},
			},
			customCss: ['./src/styles/custom.css'],
			sidebar: [
				{ label: '首页', slug: '' },
				{
					label: '工资',
					items: [{ autogenerate: { directory: '工资' } }],
				},
				{
					label: '报账',
					items: [{ autogenerate: { directory: '报账' } }],
				},
				{
					label: '医保社保',
					items: [{ autogenerate: { directory: '医保社保' } }],
				},
				{
					label: '公积金',
					items: [{ autogenerate: { directory: '公积金' } }],
				},
				{
					label: '工具与入口',
					items: [{ autogenerate: { directory: '工具与入口' } }],
				},
				{
					label: '随笔',
					items: [{ autogenerate: { directory: '随笔' } }],
				},
			],
		}),
	],
});
