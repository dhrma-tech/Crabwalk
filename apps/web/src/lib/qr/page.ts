// QR scan page (FRONTEND §7.3 [LOCKED order]): plain HTML + inline CSS + one tiny vanilla script, system
// fonts only, no framework (C14, DECISIONS P6-1). Everything works without JS except GPS features.
import { m } from '#lib/paraglide/messages.js';
import { msg } from '#lib/msg.ts';
import { relTime } from '#lib/format.ts';
import type { Near, QrData } from '#lib/server/qr.ts';

type Lang = 'en' | 'hi' | 'mr';
const ENDONYM: Record<Lang, string> = { en: 'English', hi: 'हिंदी', mr: 'मराठी' };

export const esc = (s: string | number) =>
	String(s).replace(
		/[&<>"']/g,
		(c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!
	);
const para = (s: string) => esc(s).replace(/\n/g, '<br>');

// Tideline in system fonts (Report 2 §9 item 14, T-42): app.css token values, white cards with --r-lg, kokum
// actions, ok/caution/laterite status dots; --emergency red = the pinned 112 bar only. Georgia = title fallback.
const CSS = `:root{--bg:#f5f7fa;--sf:#fff;--s2:#edf1f5;--bd:#e1e6ec;--tx:#15171a;--t2:#4a4f57;--ln:#0f6b66;--ko:#0270ae;--oko:#fff;--em:#c8102e;--gn:#2f7d4f;--ca:#8a5a00;--dg:#a8492e;--e1:0 1px 2px rgba(21,23,26,.04),0 4px 12px rgba(21,23,26,.05);color-scheme:light}
@media(prefers-color-scheme:dark){:root{--bg:#0f1215;--sf:#171b1f;--s2:#1f2429;--bd:#2a3036;--tx:#f2efe9;--t2:#b9bcc2;--ln:#5cc4bb;--ko:#e68ab0;--oko:#2a0716;--em:#d93036;--gn:#7cc69a;--ca:#e0b04a;--dg:#f08e6e;--e1:inset 0 0 0 1px rgba(255,255,255,.06);color-scheme:dark}}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--tx);font:16px/1.5 system-ui,"Noto Sans Devanagari",sans-serif;padding-bottom:104px}
:lang(hi),:lang(mr){line-height:1.65}main{max-width:640px;margin:0 auto;padding:16px 20px;display:flex;flex-direction:column;gap:16px}
h1{font:700 28px/1.25 Georgia,serif;margin:0}h2{font:600 20px/1.35 Georgia,serif;margin:0 0 8px}p{margin:0}a{color:var(--ln)}
.alt{color:var(--t2);margin-top:2px}.hero{width:100%;aspect-ratio:16/9;object-fit:cover;background:var(--s2);display:block;border-radius:24px}
.card{background:var(--sf);border-radius:24px;padding:16px;box-shadow:var(--e1)}.small{font-size:14px;color:var(--t2)}
audio,input{accent-color:var(--ko)}audio{width:100%}ul{margin:0;padding-left:20px}.near{list-style:none;padding:0}.near li{display:flex;justify-content:space-between;gap:12px;padding:10px 0;border-top:1px solid var(--bd)}.near li:first-child{border:0}
[class^=st-]::before{content:"● "}.st-open::before{color:var(--gn)}.st-risky::before,.st-caution::before{color:var(--ca)}.st-closed::before,.st-danger::before{color:var(--dg)}b{font-weight:600}
.btn{display:inline-flex;align-items:center;justify-content:center;min-height:48px;padding:0 20px;border:0;border-radius:999px;background:var(--s2);color:var(--tx);font:inherit;font-weight:600;text-decoration:none;cursor:pointer}
.pri{background:var(--ko);color:var(--oko)}.row{display:flex;flex-wrap:wrap;gap:8px}.col{display:flex;flex-direction:column;gap:12px;margin-top:8px}
.btn[aria-pressed=true]{background:var(--tx);color:var(--bg);opacity:1}
.sos{position:fixed;left:0;right:0;bottom:0;display:flex;gap:8px;padding:12px 16px calc(12px + env(safe-area-inset-bottom));background:var(--sf);border-top:1px solid var(--bd)}
.sos a,.sos button{flex:1;min-height:52px;border:0;border-radius:16px;font:inherit;font-weight:700;font-size:17px;display:flex;align-items:center;justify-content:center;text-decoration:none}
.sos a{flex:1.3;background:var(--em);color:#fff}.sos button{background:var(--s2);color:var(--tx);font-weight:600}
.sos p{position:absolute;left:16px;right:16px;bottom:100%;margin:0 0 8px;padding:8px 12px;border-radius:12px;background:var(--tx);color:var(--bg)}.sos p:empty{display:none}
label{display:flex;gap:8px;align-items:center;min-height:44px}textarea{width:100%;font:inherit;border:1.5px solid transparent;border-radius:12px;background:var(--s2);color:var(--tx);padding:12px}textarea:focus{border-color:var(--tx);background:var(--sf);outline:0}
summary{cursor:pointer;color:var(--ln);font-weight:600;min-height:44px;display:flex;align-items:center}.sponsor{color:var(--t2);font-size:14px}.hp{display:none}
:focus-visible{outline:2px solid var(--ln);outline-offset:2px}`;

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
$('smsg').textContent='';gps().then(c=>send(c.latitude.toFixed(5),c.longitude.toFixed(5)),()=>b.lat?send(b.lat,b.lng):$('smsg').textContent=b.tGps)}})()`;

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
	return `<!doctype html><html lang="${lang}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="theme-color" content="#F5F7FA" media="(prefers-color-scheme: light)"><meta name="theme-color" content="#0F1215" media="(prefers-color-scheme: dark)"><title>${esc(title)} · Crabwalk</title><style>${CSS}</style></head><body${attrs}>${body}</body></html>`;
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
	`<nav class="sos" aria-label="${esc(m.qr_emergency())}"><a href="tel:112">${esc(m.qr_call_112())}</a><button type="button" id="share" data-js hidden>${esc(m.qr_share_location())}</button><p id="smsg" role="status" aria-live="polite"></p></nav>`;

function report(code: string, reported: boolean) {
	if (reported) return `<p class="small" id="report" role="status">${esc(m.report_sent())}</p>`;
	const types = ['broken_qr', 'wrong_info', 'unsafe_spot', 'garbage']
		.map(
			(t, i) =>
				`<label><input type="radio" name="type" value="${t}"${i ? '' : ' checked'}>${esc(msg(`report_type_${t}`))}</label>`
		)
		.join('');
	return `<details id="report" class="card"><summary>${esc(m.report_problem())}</summary><form method="post" action="/q/${esc(code)}/report" class="col"><fieldset style="border:0;padding:0;margin:0"><legend class="small">${esc(m.report_problem())}</legend>${types}</fieldset><label style="flex-direction:column;align-items:stretch">${esc(m.report_details())}<textarea name="text" rows="3" maxlength="1000"></textarea></label><input class="hp" name="website" tabindex="-1" autocomplete="off" aria-hidden="true"><button class="btn pri">${esc(m.report_send())}</button></form></details>`;
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
			// Active alerts within ~2 km (Report 1 §2.2, T-44): dot + severity word, short reason, reported / expires;
			// the full reasons are on the map with the alerts layer on.
			...s.alerts.map(
				(a) =>
					`<p class="st-${a.severity}"><b>${esc(msg(`alert_${a.type}`))}</b> · ${esc(msg(`severity_${a.severity}`))}${a.reason ? ` · ${esc(a.reason)}` : ''}</p><p class="small">${esc(m.alert_times({ ago: relTime(a.reported_at, o.lang), left: relTime(a.expires_at, o.lang) }))}</p>`
			),
			s.alerts.length
				? `<p class="small"><a href="/map?focus=place/${esc(d.href.split('/').pop()!)}&amp;layers=alerts">${esc(m.map_see_on_map())}</a></p>`
				: '',
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
