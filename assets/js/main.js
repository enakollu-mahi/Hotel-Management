// --- Simple SPA Router with hash segments and query support
const Router = (() => {
  const routes = new Map();
  const parseHash = () => {
    const hash = location.hash || '#/home';
    const [path, queryString] = hash.slice(1).split('?');
    const params = {};
    if (queryString) {
      for (const part of queryString.split('&')) {
        const [k, v] = part.split('=');
        params[decodeURIComponent(k)] = decodeURIComponent(v ?? '');
      }
    }
    return { path: '/' + (path.replace(/^\/+/, '')), params };
  };
  const navigate = (href) => { location.hash = href; };
  const onChange = async () => {
    const { path, params } = parseHash();
    const handler = routes.get(path) || routes.get('/home');
    if (handler) await handler(params);
    updateActiveNav(path);
    document.getElementById('app').focus({ preventScroll: true });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  const mount = (path, handler) => routes.set(path, handler);
  const start = () => {
    window.addEventListener('hashchange', onChange);
    onChange();
  };
  const updateActiveNav = (activePath) => {
    document.querySelectorAll('[data-link]').forEach(a => {
      const path = new URL(a.href).hash.split('?')[0].slice(1);
      a.classList.toggle('active', ('/' + path.replace(/^\/+/, '')) === activePath);
    });
  };
  return { mount, start, navigate, parseHash };
})();

// --- App State (in-memory for demo)
const state = {
  rooms: [],
  services: [],
  staff: [],
  menu: { Breakfast: [], Lunch: [], Dinner: [] },
  parkingSpots: [],
  booking: {
    personal: {},
    roomId: null,
    services: [],
    staffId: null,
    checkIn: null,
    checkOut: null,
    guests: 1,
    total: 0,
    parking: { spotId: null, price: 0 }
  }
};

function seedData() {
  state.rooms = [
    { id: 'R101', name: 'Deluxe Sea View', type: 'Deluxe', capacity: 2, price: 189, status: 'available', rating: 4.7, image: 'https://share.google/images/VZ2aSAUqaRAGpQav9', location: 'East Wing, Level 10' },
    { id: 'R102', name: 'Executive Suite', type: 'Suite', capacity: 4, price: 329, status: 'booked', rating: 4.9, image: 'https://share.google/images/ulKYWNQPRUUibGJST', location: 'North Tower, Level 18' },
    { id: 'R103', name: 'Family Garden', type: 'Family', capacity: 4, price: 239, status: 'available', rating: 4.5, image: 'https://share.google/images/sF1d0QEyooxDPqyrJ', location: 'Garden Annex, Level 3' },
    { id: 'R104', name: 'Standard City View', type: 'Standard', capacity: 2, price: 129, status: 'available', rating: 4.2, image: 'https://share.google/images/FT9yoFsiojCyOQrRp', location: 'Main, Level 6' },
    { id: 'R105', name: 'Penthouse Royal', type: 'Suite', capacity: 2, price: 599, status: 'booked', rating: 5.0, image: 'https://share.google/images/ObiQpUpVatKHadu6a', location: 'Skyline, Level 30' }
  ];
  state.services = [
    { id: 'S-food', name: 'In-Room Dining', category: 'Food', price: 25, desc: '24/7 curated menu delivered to your door.', image: 'https://picsum.photos/seed/food/800/480' },
    { id: 'S-spa', name: 'Spa & Wellness', category: 'Membership', price: 49, desc: 'Access to sauna, pool, and gym.', image: 'https://picsum.photos/seed/spa/800/480' }
  ];
  state.staff = [
    { id: 'ST001', name: 'Santhosh', role: 'Chef', skill: 'Gourmet Dining', image: 'assets/staff/santhosh.jpg' },
    { id: 'ST002', name: 'Pankaj', role: 'Concierge', skill: 'City Assistance', image: 'assets/staff/pankaj.jpg' },
    { id: 'ST003', name: 'Soumya', role: 'Spa Therapist', skill: 'Wellness & Massage', image: 'assets/staff/soumya.jpg' },
    { id: 'ST004', name: 'Amit', role: 'Housekeeping', skill: 'Room Care', image: 'assets/staff/amit.jpg' }
  ];
  state.menu.Breakfast = [
    { id: 'F101', name: 'Continental Platter', desc: 'Pastries, fruits, juices', price: 16 },
    { id: 'F102', name: 'Omelette & Toast', desc: 'Free-range eggs, sourdough', price: 14 }
  ];
  state.menu.Lunch = [
    { id: 'F201', name: 'Grilled Chicken Bowl', desc: 'Greens, quinoa, herbs', price: 19 },
    { id: 'F202', name: 'Pasta Primavera', desc: 'Seasonal veggies, parmesan', price: 18 }
  ];
  state.menu.Dinner = [
    { id: 'F301', name: 'Seared Salmon', desc: 'Citrus butter, asparagus', price: 27 },
    { id: 'F302', name: 'Steak Frites', desc: 'Striploin, peppercorn, fries', price: 32 }
  ];
  state.parkingSpots = Array.from({ length: 18 }, (_, i) => ({ id: 'P' + (i+1).toString().padStart(2,'0'), available: Math.random() > 0.35 }));
}

// --- Utilities
function money(n) {
  try {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 2 }).format(Number(n));
  } catch (e) {
    return '₹' + Number(n).toFixed(2);
  }
}
function el(html) { const d = document.createElement('div'); d.innerHTML = html.trim(); return d.firstElementChild; }
function groupBy(arr, key) { return arr.reduce((acc, it) => { (acc[it[key]] ||= []).push(it); return acc; }, {}); }
function setHash(path, params) {
  const q = params ? '?' + Object.entries(params).map(([k,v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join('&') : '';
  location.hash = path + q;
}
function calcBookingTotal() {
  const room = state.rooms.find(r => r.id === state.booking.roomId);
  const roomPrice = room ? room.price : 0;
  const servicesTotal = state.booking.services
    .map(id => state.services.find(s => s.id === id)?.price || 0)
    .reduce((a,b) => a+b, 0);
  const nights = (() => {
    if (!state.booking.checkIn || !state.booking.checkOut) return 1;
    const d1 = new Date(state.booking.checkIn), d2 = new Date(state.booking.checkOut);
    const diff = Math.max(1, Math.round((d2 - d1) / (1000*60*60*24)));
    return diff;
  })();
  const parkingFee = state.booking.parking?.price || 0;
  state.booking.total = roomPrice * nights + servicesTotal + parkingFee;
}

// --- Renderers
function renderHome() {
  const app = document.getElementById('app');
  app.innerHTML = '';
  // Hero Carousel
  const hero = el(`
    <section class="section">
      <div class="carousel card" aria-roledescription="carousel" aria-label="Amenities and promotions">
        <div class="slides"></div>
      </div>
    </section>
  `);
  const slides = [
    { t: 'Wake up to azure horizons', s: 'Deluxe Sea View from ' + money(189), img: 'https://images.unsplash.com/photo-1501117716987-c8e4b1bd7a5c?q=80&w=2400&auto=format&fit=crop' },
    { t: 'Taste the city', s: 'Gourmet dining crafted by award-winning chefs', img: 'https://images.unsplash.com/photo-1544025162-d76694265947?q=80&w=2400&auto=format&fit=crop' },
    { t: 'Unwind in style', s: 'Spa, sauna, and skyline pool access', img: 'https://images.unsplash.com/photo-1515378791036-0648a3ef77b2?q=80&w=2400&auto=format&fit=crop' }
  ];
  const slidesWrap = hero.querySelector('.slides');
  slides.forEach((s, i) => {
    const node = el(`<div class="slide" style="background-image:url('${s.img}')"><div class="caption"><h3>${s.t}</h3><div class="muted">${s.s}</div><div style="margin-top:10px; display:flex; gap:8px;"><a class="btn primary" href="#/rooms">Explore Rooms</a><a class="btn ghost" href="#/services">View Services</a></div></div></div>`);
    slidesWrap.appendChild(node);
  });
  document.getElementById('app').appendChild(hero);
  // Simple auto-advance
  let idx = 0; setInterval(() => { idx = (idx + 1) % slides.length; slidesWrap.style.transform = `translateX(-${idx*100}%)`; }, 4000);

  // KPIs
  const kpis = el(`
    <section class="section">
      <div class="kpis">
        <div class="kpi"><div class="muted">Rooms Available</div><div style="font-size:22px; font-weight:800;">${state.rooms.filter(r=>r.status==='available').length}</div></div>
        <div class="kpi"><div class="muted">Dining Options</div><div style="font-size:22px; font-weight:800;">${Object.values(state.menu).flat().length}</div></div>
        <div class="kpi"><div class="muted">Happy Members</div><div style="font-size:22px; font-weight:800;">12,840</div></div>
        <div class="kpi"><div class="muted">Avg. Rating</div><div style="font-size:22px; font-weight:800;">4.6★</div></div>
      </div>
    </section>
  `);
  document.getElementById('app').appendChild(kpis);

  // Features
  const features = el(`
    <section class="section">
      <h2>Experience more with Hotel Mahi</h2>
      <p class="lead">Curated stays, inspired dining, attentive staff, and rewarding membership perks.</p>
      <div class="row">
        <div class="card"><img src="https://picsum.photos/seed/rooms/800/300" alt="Rooms" /><div class="card-body"><h3>Elegant Rooms</h3><p class="muted">From Standard to Royal Suites, always spotless and serene.</p><a class="btn" href="#/rooms">Browse Rooms</a></div></div>
        <div class="card"><img src="https://picsum.photos/seed/foodx/800/300" alt="Food" /><div class="card-body"><h3>Signature Cuisine</h3><p class="muted">All-day dining with seasonal menus and room service.</p><a class="btn" href="#/food">See Menu</a></div></div>
        <div class="card"><img src="https://picsum.photos/seed/staffx/800/300" alt="Staff" /><div class="card-body"><h3>Attentive Staff</h3><p class="muted">Concierge, housekeeping, spa and more—on your schedule.</p><a class="btn" href="#/staff">Meet the Team</a></div></div>
        <div class="card"><img src="https://picsum.photos/seed/member/800/300" alt="Membership" /><div class="card-body"><h3>Membership Benefits</h3><p class="muted">Earn rewards, get upgrades, enjoy exclusive offers.</p><a class="btn" href="#/membership">Join Now</a></div></div>
      </div>
    </section>
  `);
  document.getElementById('app').appendChild(features);
}

function renderRooms(params) {
  const app = document.getElementById('app');
  app.innerHTML = '';
  const types = Array.from(new Set(state.rooms.map(r => r.type)));
  const filter = el(`
    <section class="section">
      <h2>Rooms</h2>
      <p class="lead">Find your perfect stay. Filter by type and capacity.</p>
      <div class="toolbar">
        <div class="field">
          <label for="type">Type</label>
          <select id="type"><option value="">All</option>${types.map(t => `<option>${t}</option>`).join('')}</select>
        </div>
        <div class="field">
          <label for="cap">Min Capacity</label>
          <select id="cap"><option value="1">1</option><option value="2">2</option><option value="3">3</option><option value="4">4</option></select>
        </div>
        <div class="spacer"></div>
        <button class="btn" id="resetFilters">Reset</button>
      </div>
    </section>
  `);
  app.appendChild(filter);
  const listWrap = el(`<section class="section split"><div id="roomList" class="grid" style="grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));"></div><aside class="sidebar"><div class="card"><div class="card-body"><h3>Hotel Info</h3><p class="muted">📍 Indore • Tejaji Nagar • Near Phoenix Mall • 🏊 Pool & Spa • 🧑‍🍳 All-day dining</p><div style="margin-top:10px;">Average Rating <strong>4.6★</strong></div><div class="row" style="margin-top:12px;"><a class="btn ghost" href="#/booking">Go to Booking</a><a class="btn ghost" href="#/payment">Go to Payment</a></div></div></div></aside></section>`);
  app.appendChild(listWrap);

  const typeSel = filter.querySelector('#type');
  const capSel = filter.querySelector('#cap');
  const resetBtn = filter.querySelector('#resetFilters');
  if (params?.type) typeSel.value = params.type;
  if (params?.cap) capSel.value = params.cap;

  function draw() {
    const type = typeSel.value;
    const minCap = Number(capSel.value);
    const rooms = state.rooms.filter(r => (!type || r.type === type) && r.capacity >= minCap);
    const list = listWrap.querySelector('#roomList');
    list.innerHTML = '';
    rooms.forEach(r => {
      const card = el(`
        <article class="card">
          <img src="${r.image}" alt="${r.name}" />
          <div class="card-body">
            <div class="row" style="align-items:center; justify-content: space-between;">
              <h3 style="margin:0;">${r.name}</h3>
              <span class="badge ${r.status==='available' ? 'ok' : 'busy'}">${r.status}</span>
            </div>
            <div class="muted">Room No: <strong>${r.id}</strong> • Type: ${r.type} • Sleeps ${r.capacity} • ${r.rating}★</div>
            <div class="row" style="align-items:center; justify-content: space-between; margin-top:8px;">
              <div class="price">${money(r.price)}<span class="muted">/night</span></div>
              <div class="row" style="gap:8px; flex: 0 0 auto;">
                <button class="btn" data-view="${r.id}">Details</button>
                <button class="btn primary" ${r.status!=='available'?'disabled':''} data-book="${r.id}">Book</button>
              </div>
            </div>
          </div>
        </article>
      `);
      list.appendChild(card);
    });
  }
  draw();

  typeSel.addEventListener('change', () => draw());
  capSel.addEventListener('change', () => draw());
  resetBtn.addEventListener('click', () => { typeSel.value = ''; capSel.value = '1'; draw(); });
  listWrap.addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.view) {
      const r = state.rooms.find(x => x.id === b.dataset.view);
      if (!r) return;
      alert(`Room ${r.id} - ${r.name}\n${r.location}\nRating: ${r.rating}★\n${money(r.price)}/night`);
    }
    if (b.dataset.book) {
      state.booking.roomId = b.dataset.book;
      calcBookingTotal();
      setHash('/booking', { room: b.dataset.book });
    }
  });
}

function renderServices() {
  const app = document.getElementById('app');
  app.innerHTML = '';
  const grouped = groupBy(state.services, 'category');
  const sec = el(`<section class="section"><h2>Services</h2><p class="lead">Food and Membership services.</p><div class="row" id="svcRows"></div></section>`);
  app.appendChild(sec);
  const wrap = sec.querySelector('#svcRows');
  Object.entries(grouped).forEach(([cat, items]) => {
    const col = el(`<div class="card"><div class="card-body"><h3 style="margin:0 0 8px;">${cat}</h3><div class="grid" style="grid-template-columns: repeat(auto-fill, minmax(220px,1fr)); gap:12px;"></div></div></div>`);
    const grid = col.querySelector('.grid');
    items.forEach(s => {
      grid.appendChild(el(`
        <div class="card">
          <img src="${s.image}" alt="${s.name}" />
          <div class="card-body">
            <strong>${s.name}</strong>
            <div class="muted">${s.desc}</div>
            <div class="row" style="align-items:center; justify-content: space-between; margin-top:8px;">
              <span class="price">${money(s.price)}</span>
              <div class="row" style="gap:8px; flex: 0 0 auto;">
                ${s.category==='Food' ? '<a class="btn" href="#/food">Food Details</a>' : ''}
                ${s.category==='Membership' ? '<a class="btn" href="#/membership">Membership</a>' : ''}
                <button class="btn primary" data-request="${s.id}">Request</button>
              </div>
            </div>
          </div>
        </div>
      `));
    });
    wrap.appendChild(col);
  });
  wrap.addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return;
    const id = b.dataset.request;
    if (!id) return;
    if (!state.booking.services.includes(id)) state.booking.services.push(id);
    calcBookingTotal();
    alert('Added to booking: ' + state.services.find(s => s.id === id)?.name);
    setHash('/booking');
  });
}

function renderStaff() {
  const app = document.getElementById('app');
  app.innerHTML = '';
  const sec = el(`<section class="section"><h2>Staff</h2><p class="lead">Our team is here for you. Request preferred assistance.</p><div class="grid" id="staffGrid" style="grid-template-columns: repeat(auto-fill, minmax(220px,1fr));"></div></section>`);
  app.appendChild(sec);
  const grid = sec.querySelector('#staffGrid');
  state.staff.forEach(t => {
    grid.appendChild(el(`
      <div class="card">
        <img src="${t.image}" alt="${t.name}" onerror="this.onerror=null; this.src='https://i.pravatar.cc/160?u=${encodeURIComponent(t.name)}';" />
        <div class="card-body">
          <strong>${t.name}</strong>
          <div class="muted">${t.role} • ${t.skill}</div>
          <div class="row" style="margin-top:8px;">
            <button class="btn" data-assign="${t.id}">Assign to Booking</button>
            <a class="btn ghost" href="#/services">Services</a>
          </div>
        </div>
      </div>
    `));
  });
  grid.addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return;
    const id = b.dataset.assign;
    state.booking.staffId = id;
    alert('Assigned ' + state.staff.find(s => s.id === id)?.name + ' to your booking');
    setHash('/booking');
  });
}

function renderBooking(params) {
  const app = document.getElementById('app');
  app.innerHTML = '';
  if (params?.room) state.booking.roomId = params.room;
  calcBookingTotal();
  const sec = el(`
    <section class="section split">
      <div>
        <h2>Booking</h2>
        <p class="lead">Enter your details and customize your stay. Summary updates live.</p>
        <form id="bookForm" novalidate>
          <div class="row">
            <div class="field">
              <label for="name">Full Name</label>
              <input required id="name" name="name" placeholder="Jane Doe" />
            </div>
            <div class="field">
              <label for="email">Email</label>
              <input required id="email" type="email" placeholder="jane@example.com" />
            </div>
          </div>
          <div class="row">
            <div class="field"><label for="checkIn">Check-in</label><input id="checkIn" type="date" /></div>
            <div class="field"><label for="checkOut">Check-out</label><input id="checkOut" type="date" /></div>
            <div class="field"><label for="guests">Guests</label><select id="guests"><option>1</option><option>2</option><option>3</option><option>4</option></select></div>
          </div>
          <div class="row">
            <div class="field" style="flex:2 1 360px;">
              <label for="roomSel">Room</label>
              <select id="roomSel"></select>
            </div>
            <div class="field" style="flex:1 1 240px;">
              <label for="staffSel">Preferred Staff (optional)</label>
              <select id="staffSel"><option value="">None</option>${state.staff.map(s=>`<option value="${s.id}">${s.name} • ${s.role}</option>`).join('')}</select>
            </div>
          </div>
          <fieldset style="border:1px solid var(--border); border-radius:12px; padding:12px;">
            <legend class="muted">Additional Services</legend>
            <div class="row" style="gap:8px;">
              ${state.services.map(s=>`<label class="btn" style="gap:6px;"><input type="checkbox" data-svc="${s.id}" ${state.booking.services.includes(s.id)?'checked':''}/> ${s.name} (${money(s.price)})</label>`).join('')}
            </div>
          </fieldset>
          <fieldset style="border:1px dashed var(--border); border-radius:12px; padding:14px; background: rgba(36,48,85,0.25);">
            <legend class="muted" style="padding:0 6px;">Parking</legend>
            <div class="row" style="align-items:center; justify-content: space-between;">
              <div id="parkingStatus" class="muted" style="font-weight:600;">${state.booking.parking.spotId ? `Selected: ${state.booking.parking.spotId} • Fee ${money(state.booking.parking.price)}` : `No spot selected • Fee ${money(200)}`}</div>
              <div class="row" style="gap:8px; flex:0 0 auto;">
                <a class="btn primary" id="manageParking" href="#/parking">Reserve / Change</a>
                <button class="btn" id="clearParking" type="button">Clear</button>
              </div>
            </div>
          </fieldset>
          <div class="row" style="justify-content: space-between;">
            <div class="row" style="gap:8px;">
              <a class="btn ghost" href="#/rooms">Back to Rooms</a>
              <a class="btn ghost" href="#/services">View Services</a>
            </div>
            <button class="btn primary" type="submit">Proceed to Payment</button>
          </div>
        </form>
      </div>
      <aside class="sidebar card">
        <div class="card-body">
          <h3>Summary</h3>
          <div id="summary"></div>
        </div>
      </aside>
    </section>
  `);
  app.appendChild(sec);
  const form = sec.querySelector('#bookForm');
  const summary = sec.querySelector('#summary');
  const roomSel = sec.querySelector('#roomSel');

  roomSel.innerHTML = state.rooms.map(r => `<option value="${r.id}" ${state.booking.roomId===r.id?'selected':''} ${r.status!=='available'?'disabled':''}>${r.id} — ${r.name} — ${money(r.price)}/night ${r.status!=='available'?'(booked)':''}</option>`).join('');

  const staffSel = sec.querySelector('#staffSel');
  const checkIn = sec.querySelector('#checkIn');
  const checkOut = sec.querySelector('#checkOut');
  const guests = sec.querySelector('#guests');

  function drawSummary() {
    calcBookingTotal();
    const room = state.rooms.find(r => r.id === state.booking.roomId);
    const staff = state.staff.find(s => s.id === state.booking.staffId);
    const svcs = state.booking.services.map(id => state.services.find(s => s.id === id));
    summary.innerHTML = `
      <div class="row" style="align-items:center; justify-content: space-between;">
        <div>${room?('Room '+room.id+' — '+room.name):'No room selected'}</div>
        <div>${room?money(room.price)+'/night':''}</div>
      </div>
      <div class="muted">Dates: ${state.booking.checkIn || '—'} → ${state.booking.checkOut || '—'} • Guests: ${state.booking.guests}</div>
      <div style="margin-top:8px;">
        <div class="muted">Services</div>
        ${svcs.length?svcs.map(s=>`<div class="row" style="justify-content: space-between;"><span>${s.name}</span><span>${money(s.price)}</span></div>`).join(''): '<div class="muted">None</div>'}
      </div>
      ${state.booking.parking.spotId ? `<div class=\"row\" style=\"justify-content: space-between; margin-top:6px;\"><span>Parking (${state.booking.parking.spotId})</span><span>${money(state.booking.parking.price)}</span></div>` : ''}
      <div style="margin-top:8px;" class="muted">Staff: ${staff?staff.name+' • '+staff.role:'None'}</div>
      <hr style="border-color: var(--border);" />
      <div class="row" style="align-items:center; justify-content: space-between;">
        <strong>Total</strong>
        <strong>${money(state.booking.total)}</strong>
      </div>
      <div class="row" style="gap:8px; margin-top:10px;">
        <a class="btn" href="#/payment">Pay Now</a>
        <a class="btn ghost" href="#/rooms">Change Room</a>
      </div>
    `;
  }
  drawSummary();

  form.addEventListener('change', (e) => {
    if (e.target.matches('[data-svc]')) {
      const id = e.target.getAttribute('data-svc');
      if (e.target.checked) {
        if (!state.booking.services.includes(id)) state.booking.services.push(id);
      } else {
        state.booking.services = state.booking.services.filter(x => x !== id);
      }
    }
    if (e.target === roomSel) state.booking.roomId = roomSel.value || null;
    if (e.target === staffSel) state.booking.staffId = staffSel.value || null;
    if (e.target === checkIn) state.booking.checkIn = checkIn.value || null;
    if (e.target === checkOut) state.booking.checkOut = checkOut.value || null;
    if (e.target === guests) state.booking.guests = Number(guests.value);
    drawSummary();
  });
  // Parking manage/clear in booking
  const clearParkingBtn = sec.querySelector('#clearParking');
  if (clearParkingBtn) {
    clearParkingBtn.addEventListener('click', () => {
      state.booking.parking = { spotId: null, price: 0 };
      calcBookingTotal();
      // reflect UI
      const parkingStatus = sec.querySelector('#parkingStatus');
      if (parkingStatus) parkingStatus.textContent = `No spot selected • Fee ${money(200)}`;
      drawSummary();
    });
  }
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    setHash('/payment');
  });
}

function renderPayment() {
  const app = document.getElementById('app');
  app.innerHTML = '';
  calcBookingTotal();
  const room = state.rooms.find(r => r.id === state.booking.roomId);
  const svcs = state.booking.services.map(id => state.services.find(s => s.id === id));
  const sec = el(`
    <section class="section split">
      <div>
        <h2>Payment</h2>
        <p class="lead">Complete your booking securely.</p>
        <form id="payForm">
          <div class="field"><label for="cardName">Name on Card</label><input id="cardName" required placeholder="Jane Doe"/></div>
          <div class="row">
            <div class="field"><label for="cardNum">Card Number</label><input id="cardNum" required inputmode="numeric" maxlength="19" placeholder="1234 5678 9012 3456"/></div>
            <div class="field"><label for="exp">Expiry</label><input id="exp" required placeholder="MM/YY"/></div>
            <div class="field"><label for="cvv">CVV</label><input id="cvv" required inputmode="numeric" maxlength="4" placeholder="123"/></div>
          </div>
          <div class="row" style="justify-content: space-between;">
            <a class="btn ghost" href="#/booking">Back to Booking</a>
            <div class="row" style="gap:8px;">
              <button class="btn danger" type="button" id="cancelPay">Cancel</button>
              <button class="btn success" type="submit">Confirm & Pay</button>
            </div>
          </div>
        </form>
      </div>
      <aside class="sidebar card"><div class="card-body">
        <h3>Booking Summary</h3>
        <div class="muted">${state.booking.checkIn || '—'} → ${state.booking.checkOut || '—'} • Guests: ${state.booking.guests}</div>
        <div style="margin-top:8px;"><strong>${room?('Room '+room.id+' — '+room.name):'No room selected'}</strong> ${room?`— ${money(room.price)}/night`:''}</div>
        <div style="margin-top:8px;">
          <div class="muted">Services</div>
          ${svcs.length?svcs.map(s=>`<div class="row" style="justify-content: space-between;"><span>${s.name}</span><span>${money(s.price)}</span></div>`).join(''): '<div class="muted">None</div>'}
        </div>
        ${state.booking.parking.spotId ? `<div class=\"row\" style=\"justify-content: space-between; margin-top:6px;\"><span>Parking (${state.booking.parking.spotId})</span><span>${money(state.booking.parking.price)}</span></div>` : ''}
        <hr style="border-color: var(--border);" />
        <div class="row" style="align-items:center; justify-content: space-between;"><strong>Total</strong><strong>${money(state.booking.total)}</strong></div>
      </div></aside>
    </section>
  `);
  app.appendChild(sec);
  const form = sec.querySelector('#payForm');
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    alert('Payment successful! Your booking is confirmed.');
    // Reset minimal booking state but keep some UX context
    state.booking.services = [];
    state.booking.staffId = null;
    state.booking.total = 0;
    state.booking.parking = { spotId: null, price: 0 };
    setHash('/home');
  });
  sec.querySelector('#cancelPay').addEventListener('click', () => setHash('/booking'));
}

function renderFood() {
  const app = document.getElementById('app');
  app.innerHTML = '';
  const sec = el(`<section class="section"><h2>Food Menu</h2><p class="lead">Breakfast, Lunch, and Dinner selections.</p><div id="menuWrap" class="grid" style="grid-template-columns: repeat(auto-fill, minmax(260px,1fr));"></div><div class="row" style="margin-top:12px; justify-content: space-between;"><a class="btn ghost" href="#/services">Back to Services</a><a class="btn primary" href="#/booking">Add to Booking</a></div></section>`);
  app.appendChild(sec);
  const wrap = sec.querySelector('#menuWrap');
  Object.entries(state.menu).forEach(([cat, items]) => {
    wrap.appendChild(el(`<div class="card"><div class="card-body"><h3>${cat}</h3>${items.map(i=>`<div class=\"row\" style=\"align-items:center; justify-content: space-between; margin:8px 0;\"><div><strong>${i.name}</strong><div class=\\\"muted\\\">${i.desc}</div></div><div class=\"row\" style=\"gap:8px; align-items:center;\"><span class=\"price\">${money(i.price)}</span><button class=\"btn\" data-order=\"${i.id}\">Order</button></div></div>`).join('')}</div></div>`));
  });
  wrap.addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return;
    const itemId = b.dataset.order;
    const svc = state.services.find(s => s.category === 'Food');
    if (svc && !state.booking.services.includes(svc.id)) state.booking.services.push(svc.id);
    calcBookingTotal();
    alert('Added food to booking.');
    setHash('/booking');
  });
}

function renderParking() {
  const app = document.getElementById('app');
  app.innerHTML = '';
  const sec = el(`
    <section class="section split">
      <div>
        <h2>Parking</h2>
        <p class="lead">Reserve a secure spot. EV charging available.</p>
        <div class="card"><div class="card-body">
          <div class="grid" style="grid-template-columns: repeat(auto-fill, minmax(80px,1fr)); gap:10px;">
            ${state.parkingSpots.map(p => `<button class="btn ${p.available?'':'danger'}" data-spot="${p.id}" ${p.available?'':'disabled'}>${p.id}</button>`).join('')}
          </div>
        </div></div>
        <form id="parkForm" style="margin-top:12px;">
          <div class="row">
            <div class="field"><label>Vehicle</label><input id="veh" placeholder="Tesla Model 3"/></div>
            <div class="field"><label>Plate</label><input id="plate" placeholder="ABC-123"/></div>
          </div>
          <div class="muted" style="margin:6px 0 0 2px;">Parking fee: <strong>${money(200)}</strong> (per booking)</div>
          <div class="row" style="justify-content: space-between;">
            <a class="btn ghost" href="#/services">Back to Services</a>
            <button class="btn primary" type="submit">Reserve Parking</button>
          </div>
        </form>
      </div>
      <aside class="sidebar card"><div class="card-body">
        <h3>Instructions</h3>
        <ol class="muted">
          <li>Choose any green slot.</li>
          <li>Provide your vehicle details.</li>
          <li>Collect QR pass at reception.</li>
        </ol>
      </div></aside>
    </section>
  `);
  app.appendChild(sec);
  let selected = null;
  sec.addEventListener('click', (e) => {
    const b = e.target.closest('button.btn'); if (!b || !b.dataset.spot) return;
    selected = b.dataset.spot;
    sec.querySelectorAll('[data-spot]').forEach(x => x.classList.remove('success'));
    b.classList.add('success');
  });
  sec.querySelector('#parkForm').addEventListener('submit', (e) => {
    e.preventDefault();
    if (!selected) { alert('Please select a spot.'); return; }
    state.booking.parking = { spotId: selected, price: 200 };
    calcBookingTotal();
    alert('Reserved ' + selected + '. Parking added to booking.');
    setHash('/booking');
  });
}

function renderMembership() {
  const app = document.getElementById('app');
  app.innerHTML = '';
  const plans = [
    { id: 'M1', name: 'Silver', price: 49, perks: ['5% off rooms', 'Late checkout', 'Welcome drink'] },
    { id: 'M2', name: 'Gold', price: 129, perks: ['10% off rooms', 'Free breakfast', 'Spa access'] },
    { id: 'M3', name: 'Platinum', price: 249, perks: ['15% off rooms', 'Suite upgrades', 'Concierge priority'] }
  ];
  const sec = el(`<section class="section"><h2>Membership</h2><p class="lead">Join to unlock benefits and exclusive offers.</p><div class="grid" style="grid-template-columns: repeat(auto-fill, minmax(240px,1fr));" id="planGrid"></div></section>`);
  app.appendChild(sec);
  const grid = sec.querySelector('#planGrid');
  plans.forEach(p => {
    grid.appendChild(el(`
      <div class="card"><div class="card-body">
        <h3>${p.name}</h3>
        <div class="price" style="margin-bottom:6px;">${money(p.price)}/year</div>
        <ul class="muted" style="margin:0 0 8px 16px;">${p.perks.map(x=>`<li>${x}</li>`).join('')}</ul>
        <div class="row" style="gap:8px;">
          <button class="btn primary" data-join="${p.id}">Join Now</button>
          <a class="btn ghost" href="#/booking">Apply to Booking</a>
        </div>
      </div></div>
    `));
  });
  grid.addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return;
    alert('Membership request: ' + b.dataset.join + '. We will follow up by email.');
  });
}

function renderContact() {
  const app = document.getElementById('app');
  app.innerHTML = '';
  const sec = el(`
    <section class="section split">
      <div>
        <h2>Contact Us</h2>
        <p class="lead">We typically respond within a business day.</p>
        <form id="contactForm">
          <div class="row">
            <div class="field"><label>Name</label><input id="cname" required placeholder="Your name"/></div>
            <div class="field"><label>Email</label><input id="cemail" required type="email" placeholder="you@example.com"/></div>
          </div>
          <div class="field"><label>Message</label><textarea id="cmsg" required placeholder="How can we help?"></textarea></div>
          <div class="row" style="justify-content: space-between;">
            <a class="btn ghost" href="#/home">Home</a>
            <button class="btn primary" type="submit">Send</button>
          </div>
        </form>
      </div>
      <aside class="sidebar card"><div class="card-body">
        <h3>Reach us</h3>
        <div class="muted">Phone: +91 98765 43210, +91 91234 56789</div>
        <div class="muted">Email: hotelmahi@hotelmahi.in</div>
        <div class="muted">Address: Tejaji Nagar, Near Phoenix Mall, Indore</div>
        <div style="margin-top:10px;">
          <img src="https://maps.locationiq.com/v3/staticmap?key=pk.eyJ1Ijoibm8iLCJhIjoiY2sifQ&center=37.789,-122.401&zoom=13&size=600x300&markers=icon:large-red-cutout|37.789,-122.401" alt="Map location" />
        </div>
        <div class="row" style="gap:8px; margin-top:10px;">
          <a class="btn ghost" href="#/booking">Booking</a>
          <a class="btn ghost" href="#/services">Services</a>
        </div>
      </div></aside>
    </section>
  `);
  app.appendChild(sec);
  sec.querySelector('#contactForm').addEventListener('submit', (e) => {
    e.preventDefault();
    alert('Thanks! We have received your message.');
    setHash('/home');
  });
}

// --- Mount routes
Router.mount('/home', renderHome);
Router.mount('/rooms', renderRooms);
Router.mount('/services', renderServices);
Router.mount('/staff', renderStaff);
Router.mount('/booking', renderBooking);
Router.mount('/payment', renderPayment);
Router.mount('/food', renderFood);
Router.mount('/parking', renderParking);
Router.mount('/membership', renderMembership);
Router.mount('/contact', renderContact);

// --- Init
document.getElementById('year').textContent = new Date().getFullYear();
seedData();
Router.start();


