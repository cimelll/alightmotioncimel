// ── Linked Scripts ──
// /music-player.js

{
    "@context": "https://schema.org",
    "@type": "WebApplication",
    "name": "AM Prem by Saurus",
    "description": "Aktivasi lisensi Alight Motion Premium resmi 1 Tahun secara instan via magic link verifikasi.",
    "url": "https://am.saurusgege.my.id/",
    "applicationCategory": "UtilitiesApplication",
    "operatingSystem": "Android, iOS",
    "offers": { "@type": "Offer", "price": "0", "priceCurrency": "IDR" },
    "author": { "@type": "Person", "name": "Saurus" }
  }

// ── Next Inline Block ──

{
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    "itemListElement": [
      { "@type": "ListItem", "position": 1, "name": "Beranda", "item": "https://am.saurusgege.my.id/" },
      { "@type": "ListItem", "position": 2, "name": "VIP Access", "item": "https://am.saurusgege.my.id/vip" }
    ]
  }

// ── Next Inline Block ──

{
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "mainEntity": [
      {
        "@type": "Question",
        "name": "Apakah aktivasi Alight Motion Premium ini gratis?",
        "acceptedAnswer": { "@type": "Answer", "text": "Ya, aktivasi lisensi 1 tahun melalui portal ini gratis dan resmi menggunakan sistem magic link verifikasi." }
      },
      {
        "@type": "Question",
        "name": "Apakah perlu root atau aplikasi mod?",
        "acceptedAnswer": { "@type": "Answer", "text": "Tidak. Proses aktivasi sepenuhnya resmi tanpa root perangkat dan tanpa aplikasi modifikasi apapun." }
      },
      {
        "@type": "Question",
        "name": "Berapa lama masa berlaku magic link?",
        "acceptedAnswer": { "@type": "Answer", "text": "Magic link verifikasi berlaku selama 5 menit sejak dikirim ke email Anda." }
      }
    ]
  }

// ── Next Inline Block ──

// ─── STATE ───────────────────────────────────────
    let step1Done = false;
    let step2Done = false;
    let activeLicense = { email:'', order_id:'', uid:'', validUntil:'', dateStr:'' };
    const SALT = 'saurus_sec_salt_2026_am_prem';
    let cachedFP = null;
    let isFetchingLogs = false;
    let logsTimer = null;

    // ─── FINGERPRINT & CRYPTO ─────────────────────────
    async function sha256(str) {
      const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
      return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2,'0')).join('');
    }
    async function getFingerprint() {
      if (cachedFP) return cachedFP;
      try {
        cachedFP = await sha256([
          navigator.userAgent, screen.width+'x'+screen.height,
          Intl.DateTimeFormat().resolvedOptions().timeZone,
          new Date().getTimezoneOffset(), navigator.hardwareConcurrency
        ].join('###'));
      } catch { cachedFP = await sha256(navigator.userAgent + Math.random()); }
      return cachedFP;
    }

    // ─── STEP NAVIGATION ─────────────────────────────
    function switchStep(step) {
      if (step === 'verify' && !step1Done) { showToast('Selesaikan Step 1 dulu!', 'error'); return; }
      if (step === 'proof' && !step2Done) { showToast('Selesaikan Step 2 dulu!', 'error'); return; }

      ['send','verify','proof'].forEach(s => {
        document.getElementById('panel-'+s).style.display = s === step ? '' : 'none';
        const btn = document.getElementById('step-btn-'+s);
        btn.classList.toggle('active', s === step);
        btn.setAttribute('aria-selected', s === step ? 'true' : 'false');
      });

      if (step === 'proof') renderProofCanvas();
    }

    function goToVerify() {
      const email = document.getElementById('send-email').value.trim();
      if (email) document.getElementById('verify-email').value = email;
      switchStep('verify');
      document.getElementById('verify-link').focus();
    }

    function unlockStep2() {
      step1Done = true;
      const btn = document.getElementById('step-btn-verify');
      btn.classList.remove('locked');
      document.getElementById('step-icon-verify').className = 'fa-solid fa-bolt';
      document.getElementById('step-icon-verify').style.color = 'var(--violet)';
    }
    function unlockStep3() {
      step2Done = true;
      const btn = document.getElementById('step-btn-proof');
      btn.classList.remove('locked');
      document.getElementById('step-icon-proof').className = 'fa-solid fa-shield-check';
      document.getElementById('step-icon-proof').style.color = 'var(--green)';
    }

    // ─── FORM: SEND ───────────────────────────────────
    async function handleSend(e) {
      e.preventDefault();
      const email = document.getElementById('send-email').value.trim();
      if (!email) return showToast('Email wajib diisi.', 'error');
      if (document.getElementById('hp-send').value) return;

      setLoading('send', true);
      document.getElementById('post-send-banner').classList.remove('show');

      try {
        const fp = await getFingerprint();
        const ts = Date.now();
        const sig = await sha256(`${fp}:${ts}:send:${SALT}`);
        const res = await fetch('/api/premium-proxy', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ action: 'send', email, _sec: { fp, ts, sig } })
        });
        const data = await res.json().catch(() => ({ success: true }));
        if (res.ok && data.success !== false) {
          showToast(data.data?.message || 'Link berhasil dikirim!', 'success');
          document.getElementById('post-send-banner').classList.add('show');
          startMagicTimer();
          unlockStep2();
        } else {
          showToast(data.message || 'Gagal mengirim link.', 'error');
        }
      } catch { showToast('Gagal menghubungi server. Periksa koneksi.', 'error'); }
      finally { setLoading('send', false); }
    }

    // ─── FORM: VERIFY ────────────────────────────────
    async function handleVerify(e) {
      e.preventDefault();
      const email = document.getElementById('verify-email').value.trim();
      const link  = document.getElementById('verify-link').value.trim();
      if (!email || !link) return showToast('Email dan Link wajib diisi.', 'error');
      if (document.getElementById('hp-verify').value) return;
      if (!canVerifyToday()) return showToast('Batas aktivasi harian tercapai (maks 2x/hari).', 'error');

      setLoading('verify', true);
      try {
        const fp = await getFingerprint();
        const ts = Date.now();
        const sig = await sha256(`${fp}:${ts}:verify:${SALT}`);
        const res = await fetch('/api/premium-proxy', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ action: 'verify', email, link, _sec: { fp, ts, sig } })
        });
        const data = await res.json().catch(() => null);
        if (res.ok && data && data.success !== false) {
          const v = data.data || {};
          const now = new Date();
          const yr = new Date(now); yr.setFullYear(now.getFullYear()+1);
          activeLicense = {
            email,
            order_id: v.order_id || 'AM-'+Math.floor(100000+Math.random()*900000),
            uid: v.uid || 'AM_'+Math.floor(1e8+Math.random()*9e8),
            validUntil: yr.toLocaleDateString('id-ID',{day:'numeric',month:'long',year:'numeric'}),
            dateStr: now.toLocaleDateString('id-ID',{day:'numeric',month:'short',year:'numeric'})
          };
          recordVerifyToday(); updateQuotaUI();
          showToast('Aktivasi Berhasil! Membuka sertifikat...', 'success');
          unlockStep3();
          setTimeout(() => switchStep('proof'), 600);
        } else {
          showToast(data?.message || 'Aktivasi gagal. Pastikan link belum kedaluwarsa.', 'error');
        }
      } catch { showToast('Terjadi kesalahan saat aktivasi.', 'error'); }
      finally { setLoading('verify', false); }
    }

    function setLoading(action, on) {
      const btn = document.getElementById('btn-'+action);
      btn.disabled = on;
      document.getElementById('btn-'+action+'-text').textContent = on ? 'Memproses...' : (action==='send'?'Kirim Magic Link Verifikasi':'Aktifkan Lisensi Premium Sekarang');
      document.getElementById('btn-'+action+'-icon').style.display = on ? 'none' : '';
      document.getElementById('btn-'+action+'-spin').style.display = on ? '' : 'none';
    }

    async function pasteLink() {
      try {
        const t = await navigator.clipboard.readText();
        if (t) { document.getElementById('verify-link').value = t; showToast('Link berhasil ditempel!','success'); }
        else showToast('Clipboard kosong.','error');
      } catch { showToast('Gunakan tempel manual (tahan kolom → Paste).','error'); }
    }

    // ─── QUOTA ───────────────────────────────────────
    function getTodayKey() { const d=new Date(); return `am_prem_verify_${d.getFullYear()}_${d.getMonth()+1}_${d.getDate()}`; }
    function getTodayCount() { return parseInt(localStorage.getItem(getTodayKey())||'0',10); }
    function canVerifyToday() { return getTodayCount()<2; }
    function recordVerifyToday() { localStorage.setItem(getTodayKey(),String(getTodayCount()+1)); }
    function updateQuotaUI() {
      const el = document.getElementById('quota-badge');
      if (el) { const r=Math.max(0,2-getTodayCount()); el.textContent=`${r}/2 Hari Ini`; }
    }

    // ─── CANVAS PROOF ─────────────────────────────────
    function renderProofCanvas() {
      const canvas = document.getElementById('proof-canvas');
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      const W = canvas.width, H = canvas.height;

      function rr(x,y,w,h,r,fill,stroke,sw) {
        ctx.beginPath();
        ctx.moveTo(x+r,y); ctx.lineTo(x+w-r,y); ctx.quadraticCurveTo(x+w,y,x+w,y+r);
        ctx.lineTo(x+w,y+h-r); ctx.quadraticCurveTo(x+w,y+h,x+w-r,y+h);
        ctx.lineTo(x+r,y+h); ctx.quadraticCurveTo(x,y+h,x,y+h-r);
        ctx.lineTo(x,y+r); ctx.quadraticCurveTo(x,y,x+r,y);
        ctx.closePath();
        if(fill){ctx.fillStyle=fill;ctx.fill();}
        if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=sw||1;ctx.stroke();}
      }

      const bg = ctx.createLinearGradient(0,0,W,H);
      bg.addColorStop(0,'#05100c'); bg.addColorStop(1,'#0a1a22');
      ctx.fillStyle=bg; ctx.fillRect(0,0,W,H);

      const glow = ctx.createRadialGradient(W/2,0,0,W/2,0,W*0.6);
      glow.addColorStop(0,'rgba(45,212,148,0.14)'); glow.addColorStop(1,'transparent');
      ctx.fillStyle=glow; ctx.fillRect(0,0,W,H);

      ctx.strokeStyle='rgba(45,212,148,0.05)'; ctx.lineWidth=1;
      for(let x=0;x<W;x+=32){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,H);ctx.stroke();}
      for(let y=0;y<H;y+=32){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(W,y);ctx.stroke();}

      rr(16,16,W-32,H-32,20,null,'rgba(45,212,148,0.25)',1.5);

      const hdr = ctx.createLinearGradient(0,0,W,0);
      hdr.addColorStop(0,'rgba(45,212,148,0.16)'); hdr.addColorStop(0.5,'rgba(255,107,87,0.14)'); hdr.addColorStop(1,'rgba(155,140,255,0.16)');
      rr(16,16,W-32,70,20,hdr);
      ctx.fillStyle='rgba(45,212,148,0.15)'; ctx.fillRect(16,66,W-32,20);

      ctx.fillStyle='#2dd494'; ctx.font='bold 14px "JetBrains Mono",monospace';
      ctx.fillText('SERTIFIKAT DIGITAL ALIGHT MOTION PRO',38,58);

      rr(W-160,30,120,28,8,'rgba(45,212,148,0.15)','rgba(45,212,148,0.4)',1);
      ctx.fillStyle='#2dd494'; ctx.font='bold 12px "JetBrains Mono",monospace';
      ctx.textAlign='center'; ctx.fillText('✓ PRO ACTIVE',W-100,49); ctx.textAlign='left';

      const lg2 = ctx.createLinearGradient(0,0,W,0);
      lg2.addColorStop(0,'transparent'); lg2.addColorStop(0.3,'#2dd494'); lg2.addColorStop(0.7,'#9b8cff'); lg2.addColorStop(1,'transparent');
      ctx.strokeStyle=lg2; ctx.lineWidth=1; ctx.beginPath(); ctx.moveTo(40,100); ctx.lineTo(W-40,100); ctx.stroke();

      const fields = [
        ['EMAIL AKUN', activeLicense.email||'—'],
        ['STATUS LISENSI', 'Aktif 1 Tahun Penuh'],
        ['UID AKUN', activeLicense.uid||'—'],
        ['ORDER ID', activeLicense.order_id||'—'],
        ['BERLAKU SAMPAI', activeLicense.validUntil||'—'],
        ['TGL AKTIVASI', activeLicense.dateStr||'—'],
      ];
      let y=130;
      fields.forEach(([label,value])=>{
        ctx.fillStyle='#4a5c55'; ctx.font='11px "JetBrains Mono",monospace'; ctx.fillText(label,38,y);
        ctx.fillStyle='#eef7f3'; ctx.font='bold 14px "JetBrains Mono",monospace'; ctx.fillText(value,38,y+20);
        y+=52;
      });

      ctx.fillStyle='rgba(45,212,148,0.08)'; ctx.fillRect(38,H-190,W-76,2);
      ctx.fillStyle='#2dd494'; ctx.font='bold 11px "JetBrains Mono",monospace'; ctx.fillText('FITUR AKTIF:',38,H-170);
      const feats=['Tanpa Watermark & Bebas Iklan','Support Preset XML & 5MB+','Semua Efek VIP Terbuka','Ekspor 4K 60FPS','Penyimpanan Cloud 100GB','Fitur Kamera 3D & Layer Parenting'];
      const col=Math.ceil(feats.length/2);
      feats.forEach((f,i)=>{
        const cx=i<col?38:W/2+10; const cy=H-148+(i%col)*22;
        ctx.fillStyle='#2dd494'; ctx.font='10px monospace'; ctx.fillText('✓',cx,cy);
        ctx.fillStyle='#9db3ab'; ctx.font='11px "Manrope",sans-serif'; ctx.fillText(f,cx+16,cy);
      });

      ctx.fillStyle='rgba(255,255,255,0.04)'; ctx.fillRect(16,H-36,W-32,20);
      ctx.fillStyle='#4a5c55'; ctx.font='10px "JetBrains Mono",monospace'; ctx.textAlign='center';
      ctx.fillText('Verified by Saurus Portal · am-prem.saurus.dev · © 2026',W/2,H-22);
      ctx.textAlign='left';
    }

    function downloadProof() {
      const a = document.createElement('a');
      a.download = `AM-Premium-${activeLicense.order_id||'Sertifikat'}.png`;
      a.href = document.getElementById('proof-canvas').toDataURL('image/png');
      a.click();
      showToast('Gambar sertifikat berhasil disimpan!','success');
    }

    function copyProof() {
      const t = `=== ALIGHT MOTION PRO - 1 TAHUN ===\nEmail: ${activeLicense.email}\nStatus: Aktif 1 Tahun\nUID: ${activeLicense.uid}\nOrder ID: ${activeLicense.order_id}\nBerlaku s/d: ${activeLicense.validUntil}\n\nFitur: Tanpa Watermark, Efek VIP, 4K 60FPS, Cloud 100GB\nVerified by Saurus Portal`;
      navigator.clipboard.writeText(t).then(()=>showToast('Rincian berhasil disalin!','success'));
    }

    // ─── REAL-TIME SERVER STATUS & LATENCY CHECKER ───
    let isCheckingHealth = false;

    async function checkServerHealth(manual=false) {
      if (isCheckingHealth) return;
      isCheckingHealth = true;

      const dot = document.getElementById('ping-badge-dot');
      const coreStatus = document.getElementById('ping-core-status');
      const latText = document.getElementById('ping-latency-text');
      const proxyText = document.getElementById('proxy-status-text');
      const pill = document.getElementById('header-status-pill');
      const pillText = document.getElementById('header-status-text');

      if (manual && latText) {
        latText.textContent = 'pinging...';
      }

      const t0 = performance.now();
      try {
        const res = await fetch(`/api/premium-proxy?ping=1&_t=${Date.now()}`, {
          method: 'GET',
          cache: 'no-store'
        });
        const latency = Math.round(performance.now() - t0);

        if (res.ok) {
          if (latency < 450) {
            if (dot) dot.className = 'status-badge-dot';
            if (coreStatus) { coreStatus.textContent = 'Online'; coreStatus.style.color = '#2dd494'; }
            if (pill) pill.className = 'pill pill-online';
            if (pillText) pillText.textContent = 'Online';
            if (proxyText) { proxyText.textContent = 'Normal'; proxyText.style.color = '#34d399'; }
          } else {
            if (dot) dot.className = 'status-badge-dot slow';
            if (coreStatus) { coreStatus.textContent = 'Online'; coreStatus.style.color = '#f5b942'; }
            if (pill) pill.className = 'pill pill-online warning';
            if (pillText) pillText.textContent = 'Lambat';
            if (proxyText) { proxyText.textContent = 'Sibuk'; proxyText.style.color = '#f5b942'; }
          }
          if (latText) latText.textContent = `${latency}ms`;
          if (manual) showToast(`Server AM Core aktif (${latency}ms) - Proxy Normal`, 'success');
        } else {
          throw new Error('HTTP ' + res.status);
        }
      } catch (err) {
        const latency = Math.round(performance.now() - t0);
        if (dot) dot.className = 'status-badge-dot slow';
        if (coreStatus) { coreStatus.textContent = 'Standby'; coreStatus.style.color = '#f5b942'; }
        if (pill) pill.className = 'pill pill-online warning';
        if (pillText) pillText.textContent = 'Standby';
        if (latText) latText.textContent = `${latency || 60}ms`;
        if (proxyText) { proxyText.textContent = 'Fallback'; proxyText.style.color = '#f5b942'; }
        if (manual) showToast('Koneksi proxy dialihkan ke mode fallback standby.', 'error');
      } finally {
        isCheckingHealth = false;
      }
    }

    // ─── LIVE LOGS ────────────────────────────────────
    async function fetchLogs(showFeedback=false) {
      if (isFetchingLogs) return;
      isFetchingLogs = true;
      const btn = document.getElementById('btn-refresh');
      const icon = document.getElementById('icon-refresh');
      if (btn) btn.disabled = true;
      if (icon) icon.classList.add('fa-spin');

      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 12000);
        let res;
        try {
          res = await fetch(`/api/am-logs?_t=${Date.now()}`, { signal: controller.signal, cache: 'no-store' });
        } finally {
          clearTimeout(timeoutId);
        }

        if (!res.ok) throw new Error('HTTP ' + res.status);

        const json = await res.json();

        if (json && json.data) {
          renderLogs(json.data);
          const sync = document.getElementById('logs-sync');
          if (sync) {
            const note = json._note ? ` · ${json._note}` : '';
            sync.textContent = 'Update: ' + new Date().toLocaleTimeString('id-ID',{hour:'2-digit',minute:'2-digit',second:'2-digit'}) + note;
          }
          if (showFeedback) showToast('Logs berhasil diperbarui.','success');
        } else {
          console.warn('[Logs] Unexpected structure:', json);
          if (showFeedback) showToast('Format logs tidak dikenali.','error');
        }
      } catch (err) {
        console.warn('[Logs] Fetch error:', err.message);
        const c = document.getElementById('logs-container');
        if (c && c.innerHTML.includes('skeleton')) {
          c.innerHTML = `<div style="padding:24px;text-align:center;background:rgba(255,255,255,0.02);border:1px solid rgba(255,255,255,0.05);border-radius:14px">
            <i class="fa-solid fa-satellite-dish" style="font-size:24px;color:#33473f;margin-bottom:8px;display:block"></i>
            <p style="font-size:12px;font-weight:700;color:#5c7268;margin-bottom:4px">Sinkronisasi server...</p>
            <p style="font-size:11px;color:#33473f;margin-bottom:12px">Logs akan dimuat otomatis dalam 30 detik.</p>
            <button onclick="fetchLogs(true)" style="padding:6px 14px;border-radius:8px;background:rgba(45,212,148,0.08);border:1px solid rgba(45,212,148,0.2);color:var(--teal);font-size:11px;cursor:pointer;font-family:inherit"><i class="fa-solid fa-rotate-right"></i> Coba Lagi</button>
          </div>`;
        }
        if (showFeedback) showToast('Koneksi ke server logs timeout — akan retry otomatis.','error');
      } finally {
        isFetchingLogs = false;
        if (btn) btn.disabled = false;
        if (icon) icon.classList.remove('fa-spin');
      }
    }

    function renderLogs(data) {
      const stats = data.stats || {};
      const logs  = data.logs  || [];

      const el = (id,v) => { const e=document.getElementById(id); if(e) e.textContent=v; };
      el('stat-total',   stats.total   ??
