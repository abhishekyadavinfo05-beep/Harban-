// Product catalogue — mirrored from the original HARBAN build.
// Prices are the listed selling price; mrp drives the discount badge.

export const products = [
  {
    id: 'ht100',
    name: 'HARBAN HT100',
    tagline: 'Everyday Grooming Trimmer',
    price: 1299,
    mrp: 1999,
    rating: 4.8,
    reviews: 1200,
    image: '/images/product-ht100.jpg',
    images: [
      '/images/product-ht100.jpg',
      '/images/product-ht100-angle.jpg',
      '/images/product-ht100-blade.jpg',
      '/images/product-ht100-life.jpg',
    ],
    category: 'beard',
    badge: 'Bestseller',
    short:
      'The everyday workhorse — self-sharpening precision blades, 90-min runtime and skin-friendly rounding.',
    description:
      'The HARBAN HT100 is built for daily grooming. A high-torque motor drives self-sharpening stainless blades that stay sharp wash after wash. The ergonomic matte-black body, LED battery indicator and USB fast-charge make it the perfect first trimmer.',
    features: [
      'Self-sharpening stainless precision blades',
      '90 minutes cordless runtime, 2-hr USB fast charge',
      'Skin-friendly rounded tips — zero nicks',
      '4 guide combs (1 / 3 / 5 / 7 mm) + LED indicator',
      'Washable head, 1-year warranty',
    ],
    specs: [
      { label: 'Motor', value: '6000 RPM high-torque' },
      { label: 'Battery', value: '1200 mAh Li-ion · USB-C' },
      { label: 'Runtime', value: 'Up to 90 mins' },
      { label: 'Blades', value: 'Stainless · self-sharpening' },
      { label: 'In the box', value: 'Trimmer, 4 combs, USB cable, brush, oil' },
    ],
  },
  {
    id: 'pro-trim',
    name: 'HARBAN Pro Trim',
    tagline: 'Precision for a Sharper You',
    price: 1799,
    mrp: 2499,
    rating: 4.7,
    reviews: 892,
    image: '/images/product-protrim.jpg',
    images: [
      '/images/product-protrim.jpg',
      '/images/product-protrim-angle.jpg',
      '/images/product-protrim-blade.jpg',
      '/images/product-protrim-box.jpg',
    ],
    category: 'beard',
    badge: 'Pro Choice',
    short:
      'Salon-grade T-blade with 0.5mm zero-gap detailing and 120-min runtime for crisp lines.',
    description:
      'Pro Trim is for the detail-obsessed. Its zero-gap T-blade lines up beards, fades sideburns and defines necklines with barber precision. A slim ergonomic grip, travel lock and premium matte finish make it the upgrade your routine deserves.',
    features: [
      'Zero-gap T-blade for crisp lines & detailing',
      '120-min runtime · 5-min quick-charge boost',
      '20 lock-in length settings (0.5–10 mm)',
      'Travel lock + premium matte grip',
      'Low-noise motor under 55 dB',
    ],
    specs: [
      { label: 'Motor', value: '7000 RPM · low noise' },
      { label: 'Battery', value: '1500 mAh · USB-C fast charge' },
      { label: 'Runtime', value: 'Up to 120 mins' },
      { label: 'Blade', value: 'Zero-gap T-blade, titanium coat' },
      { label: 'In the box', value: 'Trimmer, adjustable comb, USB-C, stand' },
    ],
  },
  {
    id: 'elite',
    name: 'HARBAN Elite',
    tagline: 'Style. Control. Confidence.',
    price: 2199,
    mrp: 2999,
    rating: 4.8,
    reviews: 845,
    image: '/images/product-elite.jpg',
    images: [
      '/images/product-elite.jpg',
      '/images/product-elite-angle.jpg',
      '/images/product-elite-dial.jpg',
      '/images/product-elite-box.jpg',
    ],
    category: 'beard',
    badge: 'Flagship',
    short:
      'Flagship trimmer with precision dial, titanium blades and smart display for total control.',
    description:
      'Meet Elite — our flagship. A rotary precision dial gives 40 length settings in 0.2mm steps, titanium-coated blades glide through thick growth, and the smart LED display shows battery % and oiling reminders.',
    features: [
      'Rotary precision dial — 40 settings',
      'Titanium-coated blades, 2x sharper',
      'Smart LED display with % battery',
      '150-min runtime · wireless charging ready',
      'IPX6 washable + premium carry case',
    ],
    specs: [
      { label: 'Motor', value: '7500 RPM digital motor' },
      { label: 'Battery', value: '2000 mAh · USB-C + dock' },
      { label: 'Runtime', value: 'Up to 150 mins' },
      { label: 'Settings', value: '40 lengths · 0.4–20 mm' },
      { label: 'In the box', value: 'Trimmer, case, 3 combs, dock, USB-C' },
    ],
  },
  {
    id: 'titan',
    name: 'HARBAN Titan',
    tagline: 'Turbo Power for Dense Growth',
    price: 1999,
    mrp: 2799,
    rating: 4.7,
    reviews: 356,
    image: '/images/product-titan-main.jpg',
    images: [
      '/images/product-titan-main.jpg',
      '/images/product-titan-angle.jpg',
      '/images/product-titan-blade.jpg',
      '/images/product-titan-box.jpg',
    ],
    category: 'beard',
    badge: 'New',
    short:
      'All-metal titanium-coated build with Turbo mode for dense growth — 140-min runtime, zero tugging.',
    description:
      'Titan is the muscle of the range. Titanium-coated blades on a full-metal core power through dense, coarse growth without tugging, while Turbo mode adds 25% extra power on demand. A ribbed anti-slip grip, washable head and 140-min battery make it the heavy-duty daily driver.',
    features: [
      'Titanium-coated blades on full-metal core',
      'Turbo mode — 25% extra power on demand',
      '140-min runtime · USB-C fast charge',
      'Ribbed anti-slip grip, washable head',
      '5 guide combs + hard travel case',
    ],
    specs: [
      { label: 'Motor', value: '7200 RPM + Turbo boost' },
      { label: 'Battery', value: '1800 mAh · USB-C' },
      { label: 'Runtime', value: 'Up to 140 mins' },
      { label: 'Blade', value: 'Titanium-coated stainless' },
      { label: 'In the box', value: 'Trimmer, 5 combs, case, USB-C, oil' },
    ],
  },
  {
    id: 'bodytrim',
    name: 'HARBAN BodyTrim',
    tagline: 'Gentle on Skin, Tough on Hair',
    price: 1499,
    mrp: 2199,
    rating: 4.6,
    reviews: 421,
    image: '/images/product-bodytrim.jpg',
    images: [
      '/images/product-bodytrim.jpg',
      '/images/product-bodytrim-angle.jpg',
      '/images/product-bodytrim-head.jpg',
      '/images/product-bodytrim-wet.jpg',
    ],
    category: 'body',
    badge: 'SkinSafe',
    short:
      'Hypoallergenic wide-head body groomer with SkinSafe guard — no nicks below the neck.',
    description:
      'BodyTrim is engineered for everywhere else. A wide hypoallergenic foil + SkinSafe guard prevent nicks on sensitive skin while powering through coarse hair. Shower-safe, cordless and quiet.',
    features: [
      'SkinSafe anti-nick guard technology',
      'Wide hypoallergenic stainless head',
      'Shower-safe IPX7 waterproof',
      '100-min runtime · USB-C',
      'Dual-sided: trim + smooth foil',
    ],
    specs: [
      { label: 'Head', value: '32mm hypoallergenic foil' },
      { label: 'Waterproof', value: 'IPX7 · shower safe' },
      { label: 'Runtime', value: 'Up to 100 mins' },
      { label: 'Use', value: 'Wet & dry, all body zones' },
      { label: 'In the box', value: 'Groomer, 2 combs, USB-C, pouch' },
    ],
  },
  {
    id: 'nosetrim',
    name: 'HARBAN NoseTrim',
    tagline: 'Clean & Confident Look',
    price: 899,
    mrp: 1299,
    rating: 4.5,
    reviews: 310,
    image: '/images/product-nosetrim.jpg',
    images: [
      '/images/product-nosetrim.jpg',
      '/images/product-nosetrim-tip.jpg',
      '/images/product-nosetrim-box.jpg',
      '/images/product-nosetrim-life.jpg',
    ],
    category: 'nose',
    short:
      'Pen-size rotary nose & ear trimmer — painless, whisper-quiet, washable.',
    description:
      'Small device, big confidence. NoseTrim uses a 360-degree rotary dual-edge system that trims nose and ear hair painlessly — no pulling, no noise. Washable head and pocketable pen design.',
    features: [
      '360-degree rotary dual-edge — painless',
      'Whisper-quiet under 45 dB',
      'Washable detachable head',
      '60-min runtime · USB-C',
      'Pocket pen design + cap',
    ],
    specs: [
      { label: 'System', value: '360-degree rotary dual-edge' },
      { label: 'Noise', value: '< 45 dB' },
      { label: 'Runtime', value: 'Up to 60 mins' },
      { label: 'Cleaning', value: 'Rinseable head' },
      { label: 'In the box', value: 'Trimmer, cap, USB-C, brush' },
    ],
  },
  {
    id: 'combs-set',
    name: 'HARBAN Guide Combs',
    tagline: 'Set of 3 Precision Combs',
    price: 499,
    mrp: 799,
    rating: 4.7,
    reviews: 512,
    image: '/images/product-combs.jpg',
    images: ['/images/product-combs.jpg'],
    category: 'accessories',
    short:
      'Snag-free guide combs (3 / 6 / 9 / 12 mm) — fits all HARBAN beard trimmers.',
    description:
      'Get every length right. These reinforced, snag-free guide combs click firmly onto all HARBAN beard trimmers and glide without pulling. Includes 3, 6, 9 and 12 mm sizes in a storage tray.',
    features: [
      'Fits HT100, Pro Trim & Elite',
      'Snag-free rounded teeth',
      '4 sizes: 3/6/9/12 mm',
      'Break-resistant polymer',
    ],
    specs: [
      { label: 'Compatibility', value: 'All HARBAN beard trimmers' },
      { label: 'Sizes', value: '3 · 6 · 9 · 12 mm' },
      { label: 'Material', value: 'Reinforced ABS' },
    ],
  },
  {
    id: 'blade-pro',
    name: 'HARBAN Steel Blade',
    tagline: 'Replacement T-Blade Head',
    price: 599,
    mrp: 899,
    rating: 4.6,
    reviews: 288,
    image: '/images/product-blade.jpg',
    images: ['/images/product-blade.jpg'],
    category: 'accessories',
    short:
      'Factory-sharp replacement blade — click-on in 3 seconds, zero tools.',
    description:
      'Keep the cut factory-fresh. This genuine HARBAN replacement blade restores zero-gap sharpness in seconds — just click off the old head and click on the new one. Rinseable stainless steel.',
    features: [
      'Genuine HARBAN part',
      'Tool-free 3-sec swap',
      'Rinseable stainless',
      'Extends trimmer life 2x',
    ],
    specs: [
      { label: 'Compatibility', value: 'HT100 / Pro Trim' },
      { label: 'Material', value: 'Stainless steel' },
    ],
  },
  {
    id: 'groom-kit',
    name: 'HARBAN Groom Kit',
    tagline: 'Complete Care Essentials',
    price: 799,
    mrp: 1199,
    rating: 4.8,
    reviews: 634,
    image: '/images/product-kit.jpg',
    images: ['/images/product-kit.jpg'],
    category: 'accessories',
    badge: 'Value Pack',
    short:
      'Oil, brush, USB-C cable, pouch + 2 combs — everything to maintain the cut.',
    description:
      'Everything after the trim. Blade oil keeps cutters silent and sharp, the anti-static brush sweeps stubble, and the braided USB-C cable fast-charges any HARBAN device. Packed in a travel pouch.',
    features: [
      'Blade oil (10 ml) + brush',
      'Braided 1m USB-C fast cable',
      'Travel pouch + 2 bonus combs',
      'Works with all HARBAN devices',
    ],
    specs: [
      { label: 'Contents', value: 'Oil, brush, cable, pouch, 2 combs' },
      { label: 'Cable', value: 'USB-C · 60W braided' },
    ],
  },
]

export const categories = [
  {
    id: 'beard',
    label: 'Beard Trimmers',
    blurb: 'Daily · Pro · Elite · Titan',
    image: '/images/product-ht100.jpg',
  },
  {
    id: 'body',
    label: 'Body Trimmers',
    blurb: 'SkinSafe grooming',
    image: '/images/product-bodytrim.jpg',
  },
  {
    id: 'nose',
    label: 'Nose & Ear Trimmers',
    blurb: 'Detail finishing',
    image: '/images/product-nosetrim.jpg',
  },
  {
    id: 'accessories',
    label: 'Accessories',
    blurb: 'Blades · Kits · Combs',
    image: '/images/product-combs.jpg',
  },
]

export const marqueeStats = [
  ['2,00,000+', 'Happy Customers'],
  ['4.7 / 5', 'Average Rating'],
  ['90-min', 'Avg. Battery Life'],
  ['1 Year', 'Doorstep Warranty'],
  ['7-Day', 'Easy Returns'],
  ['24-hr', 'Dispatch Time'],
]

export const testimonials = [
  {
    n: 'Rohit M.',
    c: 'Mumbai',
    t: 'Switched from a big international brand — the HT100 cuts cleaner and the battery easily lasts me 3 weeks. Zero nicks.',
    p: 'HARBAN HT100',
  },
  {
    n: 'Arjun S.',
    c: 'Bengaluru',
    t: 'Elite dial is genius. I do my own fade now and my barber asked what I use. Worth every rupee.',
    p: 'HARBAN Elite',
  },
  {
    n: 'Karan P.',
    c: 'Delhi',
    t: 'Ordered Monday, delivered Wednesday. Tracking link worked perfectly and the BodyTrim is genuinely nick-free.',
    p: 'HARBAN BodyTrim',
  },
  {
    n: 'Imran K.',
    c: 'Hyderabad',
    t: 'Titan plows through a two-week beard without pulling once. Turbo mode is real — no tugging even on the jaw.',
    p: 'HARBAN Titan',
  },
  {
    n: 'Vikram J.',
    c: 'Pune',
    t: 'Zero-gap T-blade gave me the sharpest neckline I have had outside a salon. The travel lock is a nice touch.',
    p: 'HARBAN Pro Trim',
  },
  {
    n: 'Nikhil R.',
    c: 'Chennai',
    t: 'NoseTrim is painless and silent. I barely hear it and it rinses clean under the tap in seconds.',
    p: 'HARBAN NoseTrim',
  },
]

export const faqs = [
  {
    q: 'How long does delivery take?',
    a: 'Orders are dispatched within 24 hours. Metro cities usually receive delivery in 2–4 working days, and the rest of India in 4–7 working days. You get a tracking link by email and SMS the moment your parcel ships, and you can follow it any time from Track Order.',
  },
  {
    q: 'Is shipping really free?',
    a: 'Yes. Shipping is free on every order across India, with no minimum cart value. Cash on Delivery is also available on all pin codes we service.',
  },
  {
    q: 'Can I return a product if I do not like it?',
    a: 'You have 7 days from delivery for a no-questions return, as long as the product is unused and carries its original packaging and accessories. Raise the request from Support and we schedule a free pickup.',
  },
  {
    q: 'Is the trimmer safe for sensitive skin?',
    a: 'The HT100 and BodyTrim are built around rounded, skin-friendly tips and the SkinSafe anti-nick guard. BodyTrim is IPX7 shower-safe and uses a hypoallergenic 32mm foil, so it is suitable for sensitive skin below the neck.',
  },
  {
    q: 'Do HARBAN trimmers work while charging?',
    a: 'All models support corded use, so you can keep trimming while the unit charges over USB-C. A 5-minute quick charge gives a short top-up burst on Pro Trim, Elite and Titan.',
  },
  {
    q: 'Which trimmer should I buy first?',
    a: 'For everyday beard upkeep the HT100 is the value pick. If you line up edges and fades yourself, go Pro Trim or Elite. Add BodyTrim for below-the-neck grooming and NoseTrim for detail finishing.',
  },
]
