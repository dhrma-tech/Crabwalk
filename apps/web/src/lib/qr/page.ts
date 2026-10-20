// QR scan page (FRONTEND §7.3 [LOCKED order]): plain HTML + inline CSS + one tiny vanilla script, system
// fonts only, no framework (C14, DECISIONS P6-1). Everything works without JS except GPS features.
import { m } from '#lib/paraglide/messages.js';
import { msg } from '#lib/msg.ts';
import type { Near, QrData } from '#lib/server/qr.ts';

type Lang = 'en' | 'hi' | 'mr';
const ENDONYM: Record<Lang, string> = { en: 'English', hi: 'हिंदी', mr: 'मराठी' };

export const esc = (s: string | number) =>
	String(s).replace(
		/[&<>"']/g,
		(c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!
	);
const para = (s: string) => esc(s).replace(/\n/g, '<br>');

// Suna in system fonts (design 4a, DECISIONS P10a-1): washi, sumi, aizome; hairlines, no radii; red = 112 only.
const CSS = `:root{--bg:#f4f0e8;--sf:#f4f0e8;--bd:#d6cfc0;--tx:#1f1e1c;--t2:#5c584f;--mu:#5c584f;--ln:#2b3f5c;--cta:#2b3f5c;--oc:#f4f0e8;--em:#b3261e;--ok:#5f6f3e;--ca:#88661c;--dg:#c45a78;color-scheme:light}
@media(prefers-color-scheme:dark){:root{--bg:#16171a;--sf:#16171a;--bd:#34363b;--tx:#ece7db;--t2:#a39e92;--mu:#a39e92;--ln:#9db4d6;--cta:#9db4d6;--oc:#16171a;--ok:#a5b47f;--ca:#d1a650;--dg:#e8a0b4;color-scheme:dark}}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--tx);font:16px/1.5 system-ui,"Noto Sans Devanagari",sans-serif;padding-bottom:96px}
:lang(hi),:lang(mr){line-height:1.65}main{max-width:640px;margin:0 auto;padding:20px 24px;display:flex;flex-direction:column;gap:16px}
h1{font:600 26px/1.3 Georgia,serif;margin:0}h2{font:400 19px/1.4 Georgia,serif;margin:0 0 6px}p{margin:0}a{color:var(--tx)}
.alt{color:var(--t2);margin-top:2px}.hero{width:100%;aspect-ratio:16/9;object-fit:cover;background:var(--bd);display:block}
.card{border-top:1px solid var(--tx);padding-top:10px}.small{font-size:14px;color:var(--t2)}
audio{width:100%}ul{margin:0;padding-left:20px}.near{list-style:none;padding:0}.near li{display:flex;justify-content:space-between;gap:12px;padding:8px 0;border-top:1px solid var(--bd)}.near li:first-child{border:0}
.st-open::before,.st-risky::before,.st-closed::before{content:"● "}.st-open::before{color:var(--ok)}.st-risky::before{color:var(--ca)}.st-closed::before{color:var(--dg)}b{font-weight:600}
.btn{display:inline-flex;align-items:center;justify-content:center;min-height:46px;padding:0 18px;border:1px solid var(--tx);background:transparent;color:var(--tx);font:inherit;font-weight:600;text-decoration:none;cursor:pointer}
.pri{background:var(--cta);border-color:var(--cta);color:var(--oc)}.row{display:flex;flex-wrap:wrap;gap:8px}
.btn[aria-pressed=true]{background:var(--tx);border-color:var(--tx);color:var(--bg);opacity:1}
.sos{position:fixed;left:0;right:0;bottom:0;display:flex;gap:8px;padding:12px 16px calc(12px + env(safe-area-inset-bottom));background:var(--bg);border-top:1px solid var(--bd)}
.sos a,.sos button{flex:1;min-height:52px;border:0;font:inherit;font-weight:700;font-size:17px;display:flex;align-items:center;justify-content:center;text-decoration:none}
.sos a{flex:1.3;background:var(--em);color:#fff}.sos button{background:var(--bg);color:var(--tx);border:1px solid var(--tx);font-weight:400}
label{display:flex;gap:8px;align-items:center;min-height:44px}textarea{width:100%;font:inherit;border:1px solid var(--tx);background:transparent;color:var(--tx);padding:12px}
summary{cursor:pointer;color:var(--tx);text-decoration:underline;text-underline-offset:4px;min-height:44px;display:flex;align-items:center}.sponsor{color:var(--mu);font-size:12px}.hp{display:none}
:focus-visible{outline:2px solid var(--tx);outline-offset:3px}`;

// Scan beacon (position only if already granted), GPS-verified visit, emergency location share (P6-2).
export const JS = `(()=>{const b=document.body.dataset,$=i=>document.getElementById(i),
post=(p,o)=>fetch('/q/'+b.code+'/'+p,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(o)}),
gps=()=>new Promise((y,n)=>navigator.geolocation?navigator.geolocation.getCurrentPosition(p=>y(p.coords),n,{enableHighAccuracy:true,timeout:15e3,maximumAge:0}):n()),
scan=c=>post('scan',c?{lat:c.latitude,lng:c.longitude}:{}).catch(()=>{});
navigator.permissions?navigator.permissions.query({name:'geolocation'}).then(s=>s.state=='granted'?gps().then(scan,()=>scan()):scan(),()=>scan()):scan();
document.querySelectorAll('[data-js]').forEach(e=>e.hidden=!1);
const say=t=>{$('vmsg').textContent=t};
$('verify')&&($('verify').onclick=()=>{say(b.tWait);gps().then(c=>post('visit',{lat:c.latitude,lng:c.longitude}).then(async r=>{if(r.status==401){say(b.tSignin);$('vlogin').hidden=!1;return}if(!r.ok)return say(b.tFail);const j=await r.json();say(j.verified?b.tOk:b.tFar.replace('{m}',j.distance_m))},()=>say(b.tFail)),()=>say(b.tGps))});
$('share').onclick=()=>{const send=(la,ln)=>{const t=b.tShare+' https://maps.google.com/?q='+la+','+ln;navigator.share?navigator.share({text:t}).catch(()=>{}):location.href='sms:?&body='+encodeURIComponent(t)};
gps().then(c=>send(c.latitude.toFixed(5),c.longitude.toFixed(5)),()=>b.lat?send(b.lat,b.lng):alert(b.tGps))}})()`;

const dist = (mtr: number) =>
	mtr < 1000 ? m.qr_m({ n: mtr }) : m.qr_km({ n: (mtr / 1000).toFixed(mtr < 10_000 ? 1 : 0) });

function nearRow(x: Near) {
	const label =
		x.kind === 'utility' ? msg(`util_${x.sub}`) + (x.name ? ` · ${x.name}` : '') : x.name;
	const what = x.href ? `<a href="${esc(x.href)}">${esc(label)}</a>` : esc(label);
	const tel = x.phone ? ` · <a href="tel:${esc(x.phone)}">${esc(x.phone)}</a>` : '';
	const how =
		x.minutes != null ? m.qr_drive({ n: x.minutes, d: dist(x.distance_m) }) : dist(x.distance_m);
	return `<li><span>${what}${tel}</span><span class="small">${esc(how)}</span></li>`;
}

function shell(lang: Lang, title: string, body: string, data: Record<string, string>) {
	const attrs = Object.entries(data)
		.map(([k, v]) => ` data-${k.replace(/[A-Z]/g, (c) => '-' + c.toLowerCase())}="${esc(v)}"`)
		.join('');
	return `<!doctype html><html lang="${lang}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="theme-color" content="#F4F0E8"><title>${esc(title)} · Crabwalk</title><style>${CSS}</style></head><body${attrs}>${body}</body></html>`;
}

function langSwitch(lang: Lang, ret: string) {
	const btns = (Object.keys(ENDONYM) as Lang[])
		.map(
			(l) =>
				`<button class="btn" name="locale" value="${l}"${l === lang ? ' aria-pressed="true" disabled' : ''} lang="${l}">${ENDONYM[l]}</button>`
		)
		.join('');
	return `<form method="post" action="/prefs" class="row" aria-label="${esc(m.language())}"><input type="hidden" name="return" value="${esc(ret)}">${btns}</form>`;
}

const sos = () =>
	`<nav class="sos" aria-label="${esc(m.qr_emergency())}"><a href="tel:112">${esc(m.qr_call_112())}</a><button type="button" id="share" data-js hidden>${esc(m.qr_share_location())}</button></nav>`;

function report(code: string, reported: boolean) {
	if (reported) return `<p class="small" id="report" role="status">${esc(m.report_sent())}</p>`;
	const types = ['broken_qr', 'wrong_info', 'unsafe_spot', 'garbage']
		.map(
			(t, i) =>
				`<label><input type="radio" name="type" value="${t}"${i ? '' : ' checked'}>${esc(msg(`report_type_${t}`))}</label>`
		)
		.join('');
	return `<details id="report"><summary>${esc(m.report_problem())}</summary><form method="post" action="/q/${esc(code)}/report" class="card"><fieldset style="border:0;padding:0;margin:0"><legend class="small">${esc(m.report_problem())}</legend>${types}</fieldset><label style="flex-direction:column;align-items:stretch">${esc(m.report_details())}<textarea name="text" rows="3" maxlength="1000"></textarea></label><input class="hp" name="website" tabindex="-1" autocomplete="off" aria-hidden="true"><button class="btn">${esc(m.report_send())}</button></form></details>`;
}

const section = (title: string, html: string) =>
	`<section class="card"><h2>${esc(title)}</h2>${html}</section>`;

export function renderQrPage(
	d: QrData,
	o: { lang: Lang; reported: boolean; time: (iso: string) => string }
) {
	const parts: string[] = [];
	parts.push(
		`<header>${d.photo ? `<img class="hero" src="${esc(d.photo.src)}" alt="${esc(d.photo.alt)}" width="480" height="270" fetchpriority="high">` : ''}<h1 style="margin-top:12px">${esc(d.name)}</h1>${d.altName ? `<p class="alt" lang="${o.lang === 'mr' ? 'en' : 'mr'}">${esc(d.altName)}</p>` : ''}</header>`
	);

	if (d.kind === 'place') {
		if (d.audio)
			parts.push(
				section(
					m.audio_guide(),
					`<audio controls preload="none" src="${esc(d.audio.src)}"></audio>${d.audio.transcript ? `<details><summary>${esc(m.audio_transcript())}</summary><p>${para(d.audio.transcript)}</p></details>` : ''}`
				)
			);
		if (d.story) parts.push(section(m.place_story(), `<p>${para(d.story)}</p>`));
		if (d.dos || d.donts)
			parts.push(
				section(
					`${m.place_dos()} · ${m.place_donts()}`,
					(d.dos ? `<p><b>${esc(m.place_dos())}</b></p><p>${para(d.dos)}</p>` : '') +
						(d.donts
							? `<p style="margin-top:8px"><b>${esc(m.place_donts())}</b></p><p>${para(d.donts)}</p>`
							: '')
				)
			);
		const s = d.safety;
		const status = [
			s.monsoon
				? `<p class="st-${s.monsoon}"><b>${esc(msg(`monsoon_${s.monsoon}`))}</b>${s.monsoonReason ? ` · ${esc(s.monsoonReason)}` : ''}</p>`
				: '',
			s.text ? `<p>${para(s.text)}</p>` : '',
			s.tideDependent
				? `<p><b>${esc(m.tide_dependent())}</b></p>` +
					(s.tide?.extremes.length
						? `<p>${s.tide.extremes.map((e) => `${esc(e.type === 'high' ? m.tide_high() : m.tide_low())} ${esc(o.time(e.time))} · ${esc(e.height_m.toFixed(1))} m`).join(' · ')}</p><p class="small"><a href="${esc(s.tide.attribution.url)}">${esc(s.tide.attribution.text)}</a></p>`
						: `<p class="small">${esc(m.tide_unavailable())}</p>`)
				: ''
		].join('');
		if (status) parts.push(section(m.place_safety(), status));
	} else {
		const v = d.verdict;
		parts.push(
			section(
				m.verdict_title(),
				v && v.total && v.level && v.pct != null && !v.isNew
					? `<p><b>${esc(m.verdict_pct({ pct: Math.round(v.pct * 100), label: msg(`verdict_${d.kind}_${v.level}`) }))}</b></p><p class="small">${esc(m.verdict_votes({ n: v.total }))}</p>`
					: `<p>${esc(v?.total ? m.verdict_new() : m.verdict_none())}</p>${v?.total ? `<p class="small">${esc(m.verdict_votes({ n: v.total }))}</p>` : ''}`
			)
		);
		// First 30 items keep the page in budget; the full menu is on the listing page.
		if (d.menu.length)
			parts.push(
				section(
					m.menu(),
					`<ul>${d.menu
						.slice(0, 30)
						.map((i) => `<li>${esc(i)}</li>`)
						.join('')}</ul>`
				)
			);
		parts.push(
			section(
				m.reviews_title(),
				(d.reviews.length
					? `<ul class="near">${d.reviews.map((r) => `<li><span>${para(r.text)}</span></li>`).join('')}</ul>`
					: `<p class="small">${esc(m.reviews_none())}</p>`) +
					`<p style="margin-top:12px"><a class="btn pri" href="${esc(d.href)}">${esc(m.qr_leave_review())}</a></p>`
			)
		);
	}

	parts.push(
		`<section class="card" data-js hidden><h2>${esc(m.qr_verify_title())}</h2><p class="small">${esc(m.qr_verify_hint())}</p><p style="margin-top:12px"><button class="btn" type="button" id="verify">${esc(m.qr_verify())}</button></p><p id="vmsg" role="status" style="margin-top:8px"></p><p id="vlogin" hidden><a href="/login">${esc(m.sign_in())}</a></p></section>`
	);
	if (d.near.length)
		parts.push(section(m.qr_near_me(), `<ul class="near">${d.near.map(nearRow).join('')}</ul>`));
	parts.push(`<p><a href="${esc(d.href)}">${esc(m.qr_full_page())}</a></p>`);
	parts.push(report(d.code, o.reported));
	parts.push(langSwitch(o.lang, `/q/${d.code}`));
	if (d.sponsor)
		parts.push(`<p class="sponsor">${esc(m.qr_supported_by({ name: d.sponsor }))}</p>`);

	const data: Record<string, string> = {
		code: d.code,
		tWait: m.qr_verify_wait(),
		tOk: m.qr_verify_ok(),
		tFar: m.qr_verify_far({ m: '{m}' }),
		tSignin: m.qr_verify_signin(),
		tGps: m.qr_gps_off(),
		tFail: m.send_failed(),
		tShare: m.qr_share_text({ place: d.name })
	};
	if (d.coords) {
		data.lng = d.coords[0].toFixed(5);
		data.lat = d.coords[1].toFixed(5);
	}
	return shell(
		o.lang,
		d.name,
		`<main>${parts.join('')}</main>${sos()}<script>${JS}</script>`,
		data
	);
}

/** Unknown/retired code: still offers 112 (no JS needed for the call). */
export function renderQrMissing(lang: Lang) {
	return shell(
		lang,
		m.qr_missing(),
		`<main><h1>${esc(m.qr_missing())}</h1><p>${esc(m.qr_missing_hint())}</p><p><a class="btn pri" href="/">Crabwalk</a></p></main><nav class="sos" aria-label="${esc(m.qr_emergency())}"><a href="tel:112">${esc(m.qr_call_112())}</a></nav>`,
		{}
	);
}

/** CSP for the scan page (P10): only its own inline script (by hash), Supabase media, same-origin posts. */
export async function qrCsp(supabaseOrigin: string) {
	const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JS));
	const hash = btoa(String.fromCharCode(...new Uint8Array(d)));
	return [
		"default-src 'none'",
		`script-src 'sha256-${hash}'`,
		"style-src 'unsafe-inline'",
		`img-src ${supabaseOrigin} data:`,
		`media-src ${supabaseOrigin}`,
		"connect-src 'self'",
		"form-action 'self'",
		"base-uri 'none'",
		"frame-ancestors 'none'"
	].join('; ');
}
