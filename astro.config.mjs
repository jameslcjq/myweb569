// @ts-check
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';

// https://astro.build/config
export default defineConfig({
	site: 'https://www.yunbg.top',
	integrations: [
		starlight({
			title: '老九的学校财务工作博客',
			description: '面向江苏学校财务人员，整理工资发放、财政一体化、医保社保、公积金和学校财务软件的实际工作流程。',
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
					label: '软件',
					items: [{ autogenerate: { directory: '软件' } }],
				},
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
