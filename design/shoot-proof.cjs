// Phase 3 proof shots: hero + taluka map, 390 / 768 / 1440, normal + reduced motion, plus Marathi hero.
// Needs a production build served on :5180 (wrangler pages dev, placeholder Supabase bindings are enough).
// usage: node design/shoot-proof.cjs design/screenshots/proof/after
const { chromium } = require('../apps/web/node_modules/@playwright/test');
const fs = require('fs');
const out = process.argv[2];
fs.mkdirSync(out, { recursive: true });
const BASE = 'http://localhost:5180';
const VP = {
	390: { width: 390, height: 844 },
	768: { width: 768, height: 1024 },
	1440: { width: 1440, height: 900 }
};

async function run(b, w, rm, lang) {
	const ctx = await b.newContext({
		viewport: VP[w],
		isMobile: w === 390,
		hasTouch: w === 390,
		reducedMotion: rm ? 'reduce' : 'no-preference'
	});
	if (lang) await ctx.addCookies([{ name: 'PARAGLIDE_LOCALE', value: lang, url: BASE }]);
	const p = await ctx.newPage();
	const errs = [];
	p.on('pageerror', (e) => errs.push(String(e)));
	const tag = `${w}${rm ? '-rm' : ''}${lang ? '-' + lang : ''}`;
	await p.goto(BASE + '/', { waitUntil: 'domcontentloaded' });
	await p.waitForTimeout(1300);
	await p.screenshot({ path: `${out}/hero-${tag}-t1.png` });
	await p.waitForTimeout(8000);
	await p.screenshot({ path: `${out}/hero-${tag}.png` });
	if (!lang) {
		const sec = p.locator('#talukas');
		await sec.scrollIntoViewIfNeeded();
		await p.waitForTimeout(4500);
		const shot = async (f) => {
			await p.evaluate(() => document.querySelector('#talukas').scrollIntoView({ block: 'start' }));
			await p.mouse.move(0, 0);
			await p.waitForTimeout(150);
			await p.screenshot({ path: f, fullPage: false });
		};
		await shot(`${out}/map-${tag}.png`);
		const g = p.getByRole('button', { name: /Guhagar/ }).first();
		await g.scrollIntoViewIfNeeded();
		await g.click();
		await p.waitForTimeout(250);
		await p.screenshot({ path: `${out}/map-${tag}-guhagar-mid.png` });
		await p.waitForTimeout(1500);
		await shot(`${out}/map-${tag}-guhagar.png`);
	}
	const over = await p.evaluate(() => document.documentElement.scrollWidth - innerWidth);
	console.log('ok', tag, 'overflow', over, errs[0] ?? '');
	await ctx.close();
}

(async () => {
	const b = await chromium.launch();
	for (const w of [390, 768, 1440]) for (const rm of [false, true]) await run(b, w, rm);
	for (const w of [390, 1440]) await run(b, w, false, 'mr');
	await b.close();
})();
