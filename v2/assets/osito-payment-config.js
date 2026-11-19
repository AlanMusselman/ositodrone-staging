/* ============================================================================
 * Osito Drone LLC — GoDaddy Payments, Deposit/Full Checkout & POS Engine (v2.0)
 * Shared across Website 2.0 (2141 Mission St, Suite 201) & Staff Admin Portal
 * ============================================================================ */
(function() {
  var STORAGE_KEY = 'osito_godaddy_pay_links_v2';
  var NTFY_URL = 'https://ntfy.sh/osito_drone_inquiries_8a9f2c4e1b7d';

  var DEFAULT_PACKAGES = {
    dropin: {
      id: 'dropin',
      name: '4-Station Rotation Pass (90 Min)',
      subtitle: 'Hover • 3D Sim • Repair/Build • FPV Freestyle (2141 Mission St)',
      regularPrice: 45,
      salePrice: 35,
      depositPrice: 35,
      depositLabel: 'Pay Full Pass ($35)',
      allowDepositToggle: false,
      fullPayUrl: '',
      depositPayUrl: ''
    },
    lab4: {
      id: 'lab4',
      name: '2-Hr 4-Station Drone Flight Lab',
      subtitle: 'Up to 15 Pilots • All 4 Stations + 3 Certified Instructors',
      regularPrice: 950,
      salePrice: 713,
      depositPrice: 356,
      depositLabel: '50% Reservation Deposit ($356)',
      allowDepositToggle: true,
      fullPayUrl: '',
      depositPayUrl: ''
    },
    school6: {
      id: 'school6',
      name: '6-Week 4-Station After-School Academy',
      subtitle: 'Up to 15 Pilots • 6 Weekly Sessions ($300/wk Founding Rate)',
      regularPrice: 2400,
      salePrice: 1800,
      depositPrice: 450,
      depositLabel: '25% Cohort Hold Deposit ($450)',
      allowDepositToggle: true,
      fullPayUrl: '',
      depositPayUrl: ''
    },
    party: {
      id: 'party',
      name: 'VIP Drone Birthday Party (2-Hr Private Arena)',
      subtitle: 'Up to 12 Pilots • All 4 Stations + Party Tables & Kitchenette',
      regularPrice: 495,
      salePrice: 371,
      depositPrice: 185,
      depositLabel: '50% Date-Hold Deposit ($185)',
      allowDepositToggle: true,
      fullPayUrl: '',
      depositPayUrl: ''
    },
    kit_addon: {
      id: 'kit_addon',
      name: 'Add-On: Take-Home 3D-Printed Kit',
      subtitle: 'Printed In-House in SF • Per Pilot Add-On',
      regularPrice: 35,
      salePrice: 26,
      depositPrice: 26,
      depositLabel: 'Pay Full Kit Add-On ($26)',
      allowDepositToggle: false,
      fullPayUrl: '',
      depositPayUrl: ''
    }
  };

  function cloneDefaults() {
    var out = {};
    for (var k in DEFAULT_PACKAGES) {
      if (Object.prototype.hasOwnProperty.call(DEFAULT_PACKAGES, k)) {
        out[k] = Object.assign({}, DEFAULT_PACKAGES[k]);
      }
    }
    return out;
  }

  function isValidPayUrl(url) {
    var u = String(url || '').trim();
    return /^https:\/\/[a-z0-9.-]+\.[a-z]{2,}\//i.test(u);
  }

  function loadPayConfig() {
    var merged = cloneDefaults();
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        var saved = JSON.parse(raw);
        if (saved && typeof saved === 'object') {
          for (var k in merged) {
            if (saved[k] && typeof saved[k] === 'object') {
              if (typeof saved[k].fullPayUrl === 'string') merged[k].fullPayUrl = saved[k].fullPayUrl.trim();
              if (typeof saved[k].depositPayUrl === 'string') merged[k].depositPayUrl = saved[k].depositPayUrl.trim();
              if (Number(saved[k].salePrice) > 0) merged[k].salePrice = Number(saved[k].salePrice);
              if (Number(saved[k].depositPrice) > 0) merged[k].depositPrice = Number(saved[k].depositPrice);
            }
          }
        }
      }
    } catch (e) {}
    return merged;
  }

  function savePayConfig(cfg, publishCloud) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(cfg));
    } catch (e) {}
    if (publishCloud && typeof fetch === 'function') {
      try {
        fetch(NTFY_URL, {
          method: 'POST',
          body: JSON.stringify({
            actionType: 'godaddy_pay_links_config',
            updatedAt: new Date().toISOString(),
            packages: cfg
          })
        }).catch(function() {});
      } catch (e) {}
    }
    return cfg;
  }

  function syncPayConfigFromCloud(onDone) {
    if (typeof fetch !== 'function' || typeof process !== 'undefined') {
      if (onDone) onDone(loadPayConfig());
      return;
    }
    try {
      fetch(NTFY_URL + '/json?poll=1&since=all')
        .then(function(r) { return (r && r.ok) ? r.text() : ''; })
        .then(function(ndjson) {
          if (!ndjson) {
            if (onDone) onDone(loadPayConfig());
            return;
          }
          var lines = String(ndjson).split(/\r?\n/);
          var latestCfg = null;
          for (var i = 0; i < lines.length; i++) {
            var ln = lines[i].trim();
            if (!ln) continue;
            try {
              var evt = JSON.parse(ln);
              if (evt && evt.event === 'message' && evt.message) {
                var data = JSON.parse(evt.message);
                if (data && data.actionType === 'godaddy_pay_links_config' && data.packages) {
                  latestCfg = data.packages;
                }
              }
            } catch (e) {}
          }
          if (latestCfg) {
            var merged = loadPayConfig();
            for (var k in merged) {
              if (latestCfg[k]) {
                if (typeof latestCfg[k].fullPayUrl === 'string') merged[k].fullPayUrl = latestCfg[k].fullPayUrl.trim();
                if (typeof latestCfg[k].depositPayUrl === 'string') merged[k].depositPayUrl = latestCfg[k].depositPayUrl.trim();
                if (Number(latestCfg[k].salePrice) > 0) merged[k].salePrice = Number(latestCfg[k].salePrice);
                if (Number(latestCfg[k].depositPrice) > 0) merged[k].depositPrice = Number(latestCfg[k].depositPrice);
              }
            }
            savePayConfig(merged, false);
            if (onDone) onDone(merged);
          } else if (onDone) {
            onDone(loadPayConfig());
          }
        })
        .catch(function() {
          if (onDone) onDone(loadPayConfig());
        });
    } catch (e) {
      if (onDone) onDone(loadPayConfig());
    }
  }

  function dispatchPaymentIntent(payload) {
    var clean = Object.assign({
      _template: 'table',
      _captcha: 'false'
    }, payload || {});

    try {
      var inqs = JSON.parse(localStorage.getItem('osito_contact_submissions_v1') || '[]');
      if (!Array.isArray(inqs)) inqs = [];
      inqs.unshift({
        id: clean.booking_id || ('PAY-' + Date.now().toString().slice(-4)),
        name: clean.name || 'Website Customer',
        email: clean.email || 'info@ositodrone.com',
        phone: clean.phone || 'N/A',
        message: clean.message || '',
        recipient: 'info@ositodrone.com',
        status: 'New - Payment Intent',
        deliveryState: clean.pay_link_active ? 'Redirected to GoDaddy Checkout' : 'Needs GoDaddy Pay Link Sent',
        submittedAt: new Date().toISOString(),
        notes: 'Mode: ' + (clean.payment_mode || 'Deposit')
      });
      localStorage.setItem('osito_contact_submissions_v1', JSON.stringify(inqs));
    } catch (e) {}

    try {
      if (typeof fetch === 'function') {
        fetch(NTFY_URL, {
          method: 'POST',
          body: JSON.stringify(clean)
        }).catch(function() {});

        var fsPayload = Object.assign({}, clean);
        delete fsPayload.actionType;
        delete fsPayload.to;
        delete fsPayload.cc;
        delete fsPayload.recipient;
        delete fsPayload.pay_link_active;
        fetch('https://formsubmit.co/ajax/info@ositodrone.com', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
          body: JSON.stringify(fsPayload)
        }).catch(function() {});
      }
    } catch (e) {}
  }

  function ensureCheckoutModal() {
    var existing = document.getElementById('ositoPaymentCheckoutModal');
    if (existing) return existing;

    var wrap = document.createElement('div');
    wrap.id = 'ositoPaymentCheckoutModal';
    wrap.setAttribute('role', 'dialog');
    wrap.setAttribute('aria-modal', 'true');
    wrap.style.cssText = 'display:none; position:fixed; inset:0; z-index:999998; background:rgba(12,16,44,0.86); padding:20px; overflow-y:auto; align-items:center; justify-content:center;';
    wrap.innerHTML =
      '<div style="max-width:620px; width:100%; margin:auto; background:#FFFFFF; color:#161616; border:3px solid #7077CF; box-shadow:0 20px 50px rgba(0,0,0,0.6); font-family:Roboto,sans-serif;">' +
        '<div style="background:#232A68; color:#FFFFFF; padding:18px 22px; border-bottom:4px solid #10B981; display:flex; justify-content:space-between; align-items:flex-start; gap:12px;">' +
          '<div>' +
            '<span style="display:inline-block; background:#10B981; color:#161616; font-family:\'Fjalla One\',sans-serif; font-size:11px; font-weight:700; padding:3px 9px; letter-spacing:0.06em; text-transform:uppercase;">GODADDY SECURE CHECKOUT • 2141 MISSION ST</span>' +
            '<h3 id="ositoPayModalTitle" style="font-family:\'Fjalla One\',sans-serif; font-size:24px; margin:6px 0 2px; text-transform:uppercase; letter-spacing:0.03em;">RESERVE &amp; PAY ONLINE</h3>' +
            '<div id="ositoPayModalSub" style="font-size:13px; color:#EEF0FA;"></div>' +
          '</div>' +
          '<button type="button" id="ositoPayModalClose" style="background:#161616; color:#FFFFFF; border:1px solid #7077CF; font-family:\'Fjalla One\',sans-serif; font-size:14px; padding:6px 12px; cursor:pointer;">CLOSE &times;</button>' +
        '</div>' +
        '<div style="padding:22px;">' +
          '<div style="font-size:12px; font-weight:700; color:#232A68; text-transform:uppercase; margin-bottom:8px;">1. CHOOSE PAYMENT OPTION</div>' +
          '<div id="ositoPayModeGrid" style="display:grid; grid-template-columns:repeat(auto-fit, minmax(160px, 1fr)); gap:8px; margin-bottom:16px;">' +
            '<button type="button" data-pay-mode="deposit" id="ositoPayModeDeposit" style="padding:10px; border:2px solid #232A68; background:#EEF0FA; color:#232A68; font-family:\'Fjalla One\',sans-serif; font-size:13px; text-transform:uppercase; cursor:pointer; text-align:left;"></button>' +
            '<button type="button" data-pay-mode="full" id="ositoPayModeFull" style="padding:10px; border:2px solid #E2E2E2; background:#F6F6F6; color:#161616; font-family:\'Fjalla One\',sans-serif; font-size:13px; text-transform:uppercase; cursor:pointer; text-align:left;"></button>' +
            '<button type="button" data-pay-mode="invoice" id="ositoPayModeInvoice" style="padding:10px; border:2px solid #E2E2E2; background:#F6F6F6; color:#161616; font-family:\'Fjalla One\',sans-serif; font-size:13px; text-transform:uppercase; cursor:pointer; text-align:left;">SCHOOL PO / INVOICE<div style="font-family:Roboto,sans-serif; font-size:11px; font-weight:400; color:#5E5E5E; text-transform:none; margin-top:2px;">Request GoDaddy Invoice</div></button>' +
          '</div>' +
          '<div id="ositoPayStatusBanner" style="background:#EEF0FA; border-left:4px solid #7077CF; padding:10px 12px; font-size:12.5px; color:#232A68; margin-bottom:16px;"></div>' +
          '<div id="ositoPayErrorBox" style="display:none; background:#FEE2E2; border-left:4px solid #EF4444; color:#991B1B; padding:10px 12px; font-size:12.5px; margin-bottom:12px;"></div>' +
          '<form id="ositoPayCheckoutForm" novalidate onsubmit="return false;">' +
            '<div style="display:grid; grid-template-columns:1fr 1fr; gap:10px;">' +
              '<div><label style="display:block; font-size:11.5px; font-weight:700; color:#232A68; text-transform:uppercase; margin-bottom:4px;">Your Name / School *</label><input id="ositoPayName" type="text" required placeholder="Full Name" style="width:100%; padding:9px 10px; border:1px solid #8E93DA; background:#F6F6F6; font-size:13.5px; margin-bottom:10px;" /></div>' +
              '<div><label style="display:block; font-size:11.5px; font-weight:700; color:#232A68; text-transform:uppercase; margin-bottom:4px;">Email Address *</label><input id="ositoPayEmail" type="email" required placeholder="you@example.com" style="width:100%; padding:9px 10px; border:1px solid #8E93DA; background:#F6F6F6; font-size:13.5px; margin-bottom:10px;" /></div>' +
            '</div>' +
            '<div style="display:grid; grid-template-columns:1fr 1fr 1fr; gap:10px;">' +
              '<div><label style="display:block; font-size:11.5px; font-weight:700; color:#232A68; text-transform:uppercase; margin-bottom:4px;">Phone</label><input id="ositoPayPhone" type="tel" placeholder="(415) 555-0199" style="width:100%; padding:9px 10px; border:1px solid #8E93DA; background:#F6F6F6; font-size:13.5px; margin-bottom:10px;" /></div>' +
              '<div><label style="display:block; font-size:11.5px; font-weight:700; color:#232A68; text-transform:uppercase; margin-bottom:4px;">Target Date (Jan 5+)</label><input id="ositoPayDate" type="date" min="2027-01-05" style="width:100%; padding:9px 10px; border:1px solid #8E93DA; background:#F6F6F6; font-size:13.5px; margin-bottom:10px;" /></div>' +
              '<div><label style="display:block; font-size:11.5px; font-weight:700; color:#232A68; text-transform:uppercase; margin-bottom:4px;">Pilots</label><input id="ositoPayPilots" type="number" min="1" max="40" value="12" style="width:100%; padding:9px 10px; border:1px solid #8E93DA; background:#F6F6F6; font-size:13.5px; margin-bottom:10px;" /></div>' +
            '</div>' +
            '<button type="submit" id="ositoPaySubmitBtn" style="width:100%; padding:13px 18px; background:#059669; color:#FFFFFF; border:2px solid #10B981; font-family:\'Fjalla One\',sans-serif; font-size:16px; letter-spacing:0.05em; text-transform:uppercase; cursor:pointer; margin-top:4px;">PROCEED TO GODADDY CHECKOUT</button>' +
          '</form>' +
          '<div id="ositoPaySuccessBox" style="display:none; background:#EEF0FA; border:2px solid #059669; padding:16px; margin-top:14px; text-align:center;"></div>' +
          '<div style="margin-top:12px; font-size:11.5px; color:#5E5E5E; text-align:center;">Apple Pay • Google Pay • Visa • Mastercard • Amex • Processed securely via GoDaddy Payments</div>' +
        '</div>' +
      '</div>';

    document.body.appendChild(wrap);
    wrap.addEventListener('click', function(ev) {
      if (ev.target === wrap) wrap.style.display = 'none';
    });
    document.getElementById('ositoPayModalClose').onclick = function() {
      wrap.style.display = 'none';
    };
    return wrap;
  }

  var activeModalPkg = null;
  var activeModalMode = 'deposit';

  function refreshModalModeUI() {
    if (!activeModalPkg) return;
    var depBtn = document.getElementById('ositoPayModeDeposit');
    var fullBtn = document.getElementById('ositoPayModeFull');
    var invBtn = document.getElementById('ositoPayModeInvoice');
    var banner = document.getElementById('ositoPayStatusBanner');
    var submitBtn = document.getElementById('ositoPaySubmitBtn');

    var btns = [
      { el: depBtn, mode: 'deposit' },
      { el: fullBtn, mode: 'full' },
      { el: invBtn, mode: 'invoice' }
    ];
    for (var i = 0; i < btns.length; i++) {
      if (!btns[i].el) continue;
      var active = btns[i].mode === activeModalMode;
      btns[i].el.style.borderColor = active ? '#232A68' : '#E2E2E2';
      btns[i].el.style.background = active ? '#EEF0FA' : '#F6F6F6';
      btns[i].el.style.color = active ? '#232A68' : '#161616';
    }

    var targetUrl = activeModalMode === 'deposit' ? activeModalPkg.depositPayUrl : (activeModalMode === 'full' ? activeModalPkg.fullPayUrl : '');
    var hasLink = isValidPayUrl(targetUrl);
    var amountDue = activeModalMode === 'deposit' ? activeModalPkg.depositPrice : activeModalPkg.salePrice;

    if (activeModalMode === 'invoice') {
      if (banner) banner.innerHTML = '<strong>School PO / GoDaddy Invoice Mode:</strong> We will email a direct GoDaddy Payment Link / Invoice for <strong>$' + amountDue.toLocaleString() + '</strong> within 24 hours.';
      if (submitBtn) submitBtn.textContent = 'REQUEST GODADDY INVOICE ($' + amountDue.toLocaleString() + ')';
    } else if (hasLink) {
      if (banner) banner.innerHTML = '<strong>Instant GoDaddy Card Checkout Ready:</strong> Clicking below logs your date &amp; opens secure GoDaddy Payments for <strong>$' + amountDue.toLocaleString() + '</strong>.';
      if (submitBtn) submitBtn.textContent = 'PAY $' + amountDue.toLocaleString() + ' VIA GODADDY CHECKOUT \u2192';
    } else {
      if (banner) banner.innerHTML = '<strong>Express Payment Link Dispatch:</strong> Enter your email &amp; preferred date below—our team will immediately send your GoDaddy Pay Link for <strong>$' + amountDue.toLocaleString() + '</strong> (Apple Pay / Card).';
      if (submitBtn) submitBtn.textContent = 'SEND MY $' + amountDue.toLocaleString() + ' GODADDY PAY LINK';
    }
  }

  function openOsitoPaymentModal(pkgId, customOpts) {
    var cfg = loadPayConfig();
    var pkg = Object.assign({}, cfg[pkgId] || cfg.lab4);
    if (customOpts && Number(customOpts.salePrice) > 0) pkg.salePrice = Number(customOpts.salePrice);
    if (customOpts && Number(customOpts.depositPrice) > 0) pkg.depositPrice = Number(customOpts.depositPrice);
    activeModalPkg = pkg;
    activeModalMode = pkg.allowDepositToggle ? 'deposit' : 'full';

    var modal = ensureCheckoutModal();
    document.getElementById('ositoPayModalTitle').textContent = pkg.name;
    document.getElementById('ositoPayModalSub').textContent = pkg.subtitle;

    var depBtn = document.getElementById('ositoPayModeDeposit');
    var fullBtn = document.getElementById('ositoPayModeFull');
    if (depBtn) {
      depBtn.style.display = pkg.allowDepositToggle ? 'block' : 'none';
      depBtn.innerHTML = 'PAY DEPOSIT ($' + pkg.depositPrice.toLocaleString() + ')<div style="font-family:Roboto,sans-serif; font-size:11px; font-weight:400; color:#5E5E5E; text-transform:none; margin-top:2px;">Hold your date today</div>';
      depBtn.onclick = function() { activeModalMode = 'deposit'; refreshModalModeUI(); };
    }
    if (fullBtn) {
      fullBtn.innerHTML = 'PAY FULL ($' + pkg.salePrice.toLocaleString() + ')<div style="font-family:Roboto,sans-serif; font-size:11px; font-weight:400; color:#059669; text-transform:none; margin-top:2px;">25% Off Launch Special</div>';
      fullBtn.onclick = function() { activeModalMode = 'full'; refreshModalModeUI(); };
    }
    var invBtn = document.getElementById('ositoPayModeInvoice');
    if (invBtn) {
      invBtn.onclick = function() { activeModalMode = 'invoice'; refreshModalModeUI(); };
    }

    var pilotsInput = document.getElementById('ositoPayPilots');
    if (pilotsInput) {
      if (customOpts && customOpts.pilots) pilotsInput.value = String(customOpts.pilots);
      else if (pkg.id === 'party') pilotsInput.value = '12';
      else if (pkg.id === 'dropin') pilotsInput.value = '1';
      else pilotsInput.value = '15';
    }

    var errBox = document.getElementById('ositoPayErrorBox');
    var okBox = document.getElementById('ositoPaySuccessBox');
    var formEl = document.getElementById('ositoPayCheckoutForm');
    if (errBox) errBox.style.display = 'none';
    if (okBox) okBox.style.display = 'none';
    if (formEl) formEl.style.display = 'block';

    refreshModalModeUI();

    formEl.onsubmit = function(ev) {
      if (ev && ev.preventDefault) ev.preventDefault();
      var name = (document.getElementById('ositoPayName').value || '').trim();
      var email = (document.getElementById('ositoPayEmail').value || '').trim().toLowerCase();
      var phone = (document.getElementById('ositoPayPhone').value || '').trim();
      var dt = (document.getElementById('ositoPayDate').value || '').trim() || 'Flexible (Jan 5+)';
      var pilots = (document.getElementById('ositoPayPilots').value || '12').trim();

      if (!name || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        if (errBox) {
          errBox.textContent = 'Please enter your Name and a valid Email Address to continue.';
          errBox.style.display = 'block';
        }
        return false;
      }
      if (errBox) errBox.style.display = 'none';

      var targetUrl = activeModalMode === 'deposit' ? activeModalPkg.depositPayUrl : (activeModalMode === 'full' ? activeModalPkg.fullPayUrl : '');
      var hasLink = activeModalMode !== 'invoice' && isValidPayUrl(targetUrl);
      var amt = activeModalMode === 'deposit' ? activeModalPkg.depositPrice : activeModalPkg.salePrice;
      var bookingId = 'PAY-' + Date.now().toString().slice(-4);

      dispatchPaymentIntent({
        actionType: 'contact_form_inquiry',
        booking_id: bookingId,
        _subject: (hasLink ? 'GoDaddy Checkout Started: ' : 'Send GoDaddy Pay Link: ') + activeModalPkg.name + ' ($' + amt + ') — ' + name,
        _cc: 'alan@ositodrone.com,' + email,
        _replyto: email,
        name: name,
        email: email,
        phone: phone || 'N/A',
        package_name: activeModalPkg.name,
        payment_mode: activeModalMode.toUpperCase() + ' ($' + amt + ')',
        target_date: dt,
        pilots: pilots,
        pay_link_active: hasLink,
        message: 'Studio 2141 Mission St Booking & Payment Request\nPackage: ' + activeModalPkg.name + '\nPayment Mode: ' + activeModalMode.toUpperCase() + ' ($' + amt + ')\nPreferred Date: ' + dt + '\nPilots: ' + pilots + '\nCheckout Link Active: ' + (hasLink ? targetUrl : 'Not set yet — send GoDaddy Pay Link to ' + email)
      });

      if (hasLink) {
        try { window.open(targetUrl, '_blank', 'noopener'); } catch (e) {}
        if (okBox) {
          okBox.innerHTML =
            '<div style="font-family:\'Fjalla One\',sans-serif; font-size:20px; color:#232A68; margin-bottom:6px;">RESERVATION LOGGED (' + bookingId + ') — OPENING GODADDY CHECKOUT</div>' +
            '<p style="font-size:13.5px; color:#161616; margin:0 0 12px;">If the GoDaddy payment tab did not open automatically, click below:</p>' +
            '<a href="' + targetUrl.replace(/"/g, '&quot;') + '" target="_blank" rel="noopener" style="display:inline-block; background:#059669; color:#FFFFFF; border:2px solid #10B981; padding:11px 20px; font-family:\'Fjalla One\',sans-serif; font-size:15px; text-decoration:none; text-transform:uppercase;">COMPLETE $' + amt.toLocaleString() + ' PAYMENT ON GODADDY &rarr;</a>';
          okBox.style.display = 'block';
        }
      } else {
        if (formEl) formEl.style.display = 'none';
        if (okBox) {
          okBox.innerHTML =
            '<div style="font-family:\'Fjalla One\',sans-serif; font-size:21px; color:#232A68; margin-bottom:6px;">REQUEST RECEIVED (' + bookingId + ')!</div>' +
            '<p style="font-size:14px; color:#059669; font-weight:700; margin:0 0 6px;">Thank you! We will send your secure GoDaddy Payment Link for $' + amt.toLocaleString() + ' within 24 hours.</p>' +
            '<p style="font-size:12.5px; color:#5E5E5E; margin:0;">Preferred Date: ' + dt + ' • Pilots: ' + pilots + '</p>';
          okBox.style.display = 'block';
        }
      }
      return false;
    };

    modal.style.display = 'flex';
  }

  window.OSITO_PAYMENT_CONFIG = {
    STORAGE_KEY: STORAGE_KEY,
    DEFAULT_PACKAGES: DEFAULT_PACKAGES,
    load: loadPayConfig,
    save: savePayConfig,
    syncFromCloud: syncPayConfigFromCloud,
    isValidPayUrl: isValidPayUrl
  };
  window.openOsitoPaymentModal = openOsitoPaymentModal;

  // Auto-sync latest GoDaddy Pay Links from cloud on page load
  syncPayConfigFromCloud();
})();
