// Requirement portal — question schema.
// Every question is defined here once; the renderer in RequirementPortalPage.tsx
// handles the field type. `image` points at /req-images/<file>.jpg.

export type FieldType =
  | 'text'
  | 'email'
  | 'tel'
  | 'number'
  | 'textarea'
  | 'select'
  | 'radio'
  | 'yesno'
  | 'slider'
  | 'imagechoice';

export interface Question {
  id: string;
  label: string;
  help?: string;
  type: FieldType;
  section: SectionId;
  image?: string;
  options?: { value: string; label: string; image?: string; desc?: string }[];
  placeholder?: string;
  unit?: string;
  min?: number;
  max?: number;
  step?: number;
  allowOther?: boolean;
  otherLabel?: string;
  required?: boolean;
  conditional?: { field: string; equals: string };
}

export type SectionId =
  | 'contact'
  | 'volume'
  | 'performance'
  | 'battery'
  | 'body'
  | 'platform'
  | 'operations'
  | 'delivery'
  | 'features';

export interface Section {
  id: SectionId;
  title: string;
  short: string;
  icon: string;
  intro: string;
}

export const SECTIONS: Section[] = [
  {
    id: 'contact',
    title: 'About You',
    short: 'Contact',
    icon: 'user',
    intro: 'Let us know who we are talking to.',
  },
  {
    id: 'volume',
    title: 'Fleet Requirement',
    short: 'Volume',
    icon: 'layers',
    intro: 'How many e-PODs you need, and when.',
  },
  {
    id: 'performance',
    title: 'Performance',
    short: 'Performance',
    icon: 'gauge',
    intro: 'How the e-POD should perform on the road.',
  },
  {
    id: 'battery',
    title: 'Battery & Charging',
    short: 'Battery',
    icon: 'battery',
    intro: 'Power architecture and charging needs.',
  },
  {
    id: 'body',
    title: 'Body & Platform',
    short: 'Body',
    icon: 'box',
    intro: 'How the e-POD should look and what it should carry.',
  },
  {
    id: 'operations',
    title: 'Operating Environment',
    short: 'Environment',
    icon: 'map',
    intro: 'Where and how the e-POD will run every day.',
  },
  {
    id: 'delivery',
    title: 'Delivery & Logistics',
    short: 'Delivery',
    icon: 'truck',
    intro: 'Where we ship and on what terms.',
  },
  {
    id: 'features',
    title: 'Safety & Feature Opt-ins',
    short: 'Features',
    icon: 'shield',
    intro: 'Tick the features you need on every unit.',
  },
];

const other = (label = 'Other (please specify)') => ({ value: 'other', label });

export const QUESTIONS: Question[] = [
  // ---------- SECTION 1 : ABOUT YOU ----------
  {
    id: 'contactName',
    label: 'Your Name',
    type: 'text',
    section: 'contact',
    placeholder: 'Full name',
    required: true,
  },
  {
    id: 'companyName',
    label: 'Company Name',
    type: 'text',
    section: 'contact',
    placeholder: 'Registered / trading name',
    required: true,
  },
  {
    id: 'email',
    label: 'Email ID',
    type: 'email',
    section: 'contact',
    placeholder: 'name@company.com',
    required: true,
  },

  // ---------- SECTION 2 : FLEET REQUIREMENT ----------
  {
    id: 'pilotQuantity',
    label: 'How many e-PODs do you need for the pilot?',
    help: 'The first batch you want us to build and hand over.',
    type: 'number',
    section: 'volume',
    placeholder: 'e.g. 10',
    unit: 'units',
    min: 1,
    required: true,
  },
  {
    id: 'scaleQuantity',
    label: 'How many e-PODs do you need after scaling up?',
    help: 'Your projected fleet size once the pilot proves out.',
    type: 'number',
    section: 'volume',
    placeholder: 'e.g. 250',
    unit: 'units',
    min: 0,
    required: true,
  },
  {
    id: 'pilotTimeline',
    label: 'Approximate timeline for pilot delivery',
    help: 'When do you need the first units in hand?',
    type: 'select',
    section: 'volume',
    options: [
      { value: '30-days', label: 'Within 30 days' },
      { value: '1-3-months', label: '1 to 3 months' },
      { value: '3-6-months', label: '3 to 6 months' },
      { value: '6-12-months', label: '6 to 12 months' },
      { value: '12-plus-months', label: 'More than 12 months' },
      other('Other (please specify)'),
    ],
    required: true,
  },
  {
    id: 'scaleTimeline',
    label: 'Approximate timeline for scaled-up delivery',
    help: 'By when should the full fleet be delivered?',
    type: 'select',
    section: 'volume',
    options: [
      { value: '3-6-months', label: 'Within 3 to 6 months' },
      { value: '6-12-months', label: '6 to 12 months' },
      { value: '12-24-months', label: '12 to 24 months' },
      { value: '24-plus-months', label: 'More than 24 months' },
      other('Other (please specify)'),
    ],
    required: true,
  },
  {
    id: 'budgetPerUnit',
    label: 'Estimated budget for 1 e-POD',
    help: 'Your target price per unit, in Indian Rupees.',
    type: 'number',
    section: 'volume',
    placeholder: 'e.g. 450000',
    unit: 'INR / unit',
    min: 0,
    required: true,
  },

  // ---------- SECTION 3 : PERFORMANCE ----------
  {
    id: 'topSpeed',
    label: 'Top Speed',
    help: 'Maximum speed you expect the e-POD to cruise at.',
    type: 'select',
    section: 'performance',
    image: '/req-images/speed.jpg',
    options: [
      { value: '25', label: '25 km/h' },
      { value: '40', label: '40 km/h' },
      { value: '60', label: '60 km/h' },
      { value: '80', label: '80 km/h' },
      other('Other (please specify)'),
    ],
    required: true,
  },
  {
    id: 'range',
    label: 'Range per charge',
    help: 'How far should it go on a single full charge?',
    type: 'select',
    section: 'performance',
    image: '/req-images/range.jpg',
    options: [
      { value: '50', label: 'Up to 50 km' },
      { value: '100', label: 'Up to 100 km' },
      { value: '150', label: 'Up to 150 km' },
      { value: '200', label: 'Up to 200 km' },
      { value: '250-plus', label: 'More than 250 km' },
      other('Other (please specify)'),
    ],
    required: true,
  },
  {
    id: 'storageSize',
    label: 'Storage Size',
    help: 'Cargo volume you need, in cubic feet or litres.',
    type: 'select',
    section: 'performance',
    image: '/req-images/storage-size.jpg',
    options: [
      { value: '10-20', label: '10 - 20 cubic feet' },
      { value: '20-40', label: '20 - 40 cubic feet' },
      { value: '40-60', label: '40 - 60 cubic feet' },
      { value: '60-plus', label: 'More than 60 cubic feet' },
      other('Other (please specify)'),
    ],
    required: true,
  },
  {
    id: 'overallSize',
    label: 'Overall Vehicle Size',
    help: 'Approximate length x width x height of the e-POD.',
    type: 'textarea',
    section: 'performance',
    image: '/req-images/overall-size.jpg',
    placeholder: 'e.g. Length 3200 mm x Width 1600 mm x Height 1900 mm',
    required: true,
  },
  {
    id: 'groundClearance',
    label: 'Ground Clearance',
    help: 'Minimum clearance needed to handle uneven roads.',
    type: 'select',
    section: 'performance',
    image: '/req-images/ground-clearance.jpg',
    options: [
      { value: '120', label: '120 mm' },
      { value: '150', label: '150 mm' },
      { value: '180', label: '180 mm' },
      { value: '200-plus', label: 'More than 200 mm' },
      other('Other (please specify)'),
    ],
    required: true,
  },

  // ---------- SECTION 4 : BATTERY & CHARGING ----------
  {
    id: 'batteryType',
    label: 'Do you need battery swapping or a fixed battery?',
    type: 'radio',
    section: 'battery',
    image: '/req-images/battery-swapping.jpg',
    options: [
      {
        value: 'swapping',
        label: 'Battery Swapping',
        desc: 'Drive-in swap stations, minimal downtime.',
        image: '/req-images/battery-swapping.jpg',
      },
      {
        value: 'fixed',
        label: 'Fixed Battery',
        desc: 'Charged on-board via plug-in or dedicated bay.',
        image: '/req-images/battery-fixed.jpg',
      },
      other('Other (please specify)'),
    ],
    required: true,
  },
  {
    id: 'voltageArchitecture',
    label: 'Voltage Architecture',
    help: 'Required for a fixed-battery build. We confirm final spec with our electrical team.',
    type: 'select',
    section: 'battery',
    image: '/req-images/voltage.jpg',
    options: [
      { value: '48', label: '48V' },
      { value: '72', label: '72V' },
      { value: '96', label: '96V' },
      { value: '120-plus', label: '120V and above' },
      other('Other (please specify)'),
    ],
    conditional: { field: 'batteryType', equals: 'fixed' },
    required: true,
  },
  {
    id: 'chargingTime',
    label: 'Charging Time',
    help: 'How long can the vehicle sit while charging?',
    type: 'select',
    section: 'battery',
    image: '/req-images/charging-time.jpg',
    options: [
      { value: '1-2', label: '1 to 2 hours' },
      { value: '2-4', label: '2 to 4 hours' },
      { value: '4-6', label: '4 to 6 hours' },
      { value: 'overnight', label: 'Overnight (8+ hours)' },
      other('Other (please specify)'),
    ],
    required: true,
  },
  {
    id: 'temperatureRange',
    label: 'Temperature Conditions',
    help: 'Drag the slider across the range of temperatures the e-POD must operate in.',
    type: 'slider',
    section: 'battery',
    image: '/req-images/temperature.jpg',
    min: -20,
    max: 55,
    step: 5,
    unit: '°C',
    required: true,
  },

  // ---------- SECTION 5 : BODY & PLATFORM ----------
  {
    id: 'loadCapacity',
    label: 'Load Capacity (excluding driver & battery)',
    help: 'Payload the e-POD must carry, in kilograms.',
    type: 'select',
    section: 'body',
    image: '/req-images/load-capacity.jpg',
    options: [
      { value: '100', label: 'Up to 100 kg' },
      { value: '250', label: 'Up to 250 kg' },
      { value: '500', label: 'Up to 500 kg' },
      { value: '750', label: 'Up to 750 kg' },
      { value: '1000-plus', label: 'More than 1000 kg' },
      other('Other (please specify)'),
    ],
    required: true,
  },
  {
    id: 'bodyStyle',
    label: 'Do you need a sleek body or a boxy body?',
    type: 'imagechoice',
    section: 'body',
    options: [
      {
        value: 'sleek',
        label: 'Sleek Body',
        desc: 'Aerodynamic, rounded, modern styling.',
        image: '/req-images/body-sleek.jpg',
      },
      {
        value: 'boxy',
        label: 'Boxy Body',
        desc: 'Maximum cargo volume, utilitarian and rugged.',
        image: '/req-images/body-boxy.jpg',
      },
      other('Other (please specify)'),
    ],
    required: true,
  },
  {
    id: 'needApp',
    label: 'Do you need an app to manage and track the e-PODs?',
    help: 'Fleet dashboard with live location, health and utilisation.',
    type: 'yesno',
    section: 'body',
    image: '/req-images/app.jpg',
    required: true,
  },

  // ---------- SECTION 6 : OPERATING ENVIRONMENT ----------
  {
    id: 'landscape',
    label: 'Intended Landscape',
    help: 'The kind of roads the e-POD will run on.',
    type: 'imagechoice',
    section: 'operations',
    options: [
      {
        value: 'bumpy',
        label: 'Bumpy Roads',
        desc: 'Uneven, unpaved and broken surfaces.',
        image: '/req-images/bumpy-roads.jpg',
      },
      {
        value: 'smooth',
        label: 'Smooth Roads',
        desc: 'Paved, well-maintained city and highway roads.',
        image: '/req-images/smooth-roads.jpg',
      },
    ],
    required: true,
  },
  {
    id: 'coldStorage',
    label: 'Do you need cold storage?',
    help: 'Refrigerated cargo space with temperature control.',
    type: 'yesno',
    section: 'operations',
    image: '/req-images/cold-storage.jpg',
    required: true,
  },

  // ---------- SECTION 7 : DELIVERY & LOGISTICS ----------
  {
    id: 'deliveryLocation',
    label: 'Where should we deliver the e-POD?',
    help: 'City, state and country of delivery.',
    type: 'textarea',
    section: 'delivery',
    image: '/req-images/delivery-location.jpg',
    placeholder: 'e.g. Plant 4, Sanand, Gujarat, India',
    required: true,
  },
  {
    id: 'pointOfContact',
    label: 'Point of Contact',
    help: 'Who should our team reach out to for this requirement?',
    type: 'textarea',
    section: 'delivery',
    image: '/req-images/poc.jpg',
    placeholder: 'Name, role, phone number',
    required: true,
  },
  {
    id: 'deliveryBasis',
    label: 'Delivery Basis',
    help: 'The Incoterm you want us to quote against.',
    type: 'radio',
    section: 'delivery',
    options: [
      {
        value: 'exw',
        label: 'Ex-Works',
        desc: 'You take over at our plant.',
        image: '/req-images/delivery-exw.jpg',
      },
      {
        value: 'fob',
        label: 'FOB',
        desc: 'Free on Board at the named port.',
        image: '/req-images/delivery-fob.jpg',
      },
      {
        value: 'fca',
        label: 'FCA',
        desc: 'Free Carrier at the seller premises.',
        image: '/req-images/delivery-fca.jpg',
      },
      {
        value: 'ddp',
        label: 'DDP',
        desc: 'Delivered Duty Paid to your door.',
        image: '/req-images/delivery-ddp.jpg',
      },
    ],
    required: true,
  },

  // ---------- SECTION 8 : FEATURES ----------
  {
    id: 'airbags',
    label: 'Airbags',
    type: 'yesno',
    section: 'features',
    image: '/req-images/airbag.jpg',
    required: true,
  },
  {
    id: 'abs',
    label: 'ABS (Anti-lock Braking System)',
    type: 'yesno',
    section: 'features',
    image: '/req-images/abs.jpg',
    required: true,
  },
  {
    id: 'iotEnabled',
    label: 'IoT Enabled',
    help: 'Connected telematics, diagnostics and over-the-air updates.',
    type: 'yesno',
    section: 'features',
    image: '/req-images/iot.jpg',
    required: true,
  },
  {
    id: 'seatbelt',
    label: 'Seatbelt',
    type: 'yesno',
    section: 'features',
    image: '/req-images/seatbelt.jpg',
    required: true,
  },
  {
    id: 'ac',
    label: 'AC (Air Conditioning)',
    type: 'yesno',
    section: 'features',
    image: '/req-images/ac.jpg',
    required: true,
  },
  {
    id: 'pushbackSeats',
    label: 'Pushback Seats',
    type: 'yesno',
    section: 'features',
    image: '/req-images/pushback.jpg',
    required: true,
  },
  {
    id: 'v2x',
    label: 'V2X (Vehicle-to-Everything)',
    type: 'yesno',
    section: 'features',
    image: '/req-images/v2x.jpg',
    required: true,
  },
  {
    id: 'tractionControl',
    label: 'Traction Control System',
    type: 'yesno',
    section: 'features',
    image: '/req-images/traction.jpg',
    required: true,
  },
  {
    id: 'autonomous',
    label: 'Autonomous Vehicle',
    type: 'yesno',
    section: 'features',
    image: '/req-images/av.jpg',
    required: true,
  },
  {
    id: 'vinylSticker',
    label: 'Do you need vinyl stickering of your brand?',
    type: 'yesno',
    section: 'features',
    image: '/req-images/vinyl.jpg',
    required: true,
  },
];

export const questionsFor = (section: SectionId) =>
  QUESTIONS.filter((q) => q.section === section);

export const findQuestion = (id: string) => QUESTIONS.find((q) => q.id === id);

export const FEATURE_QUESTIONS = QUESTIONS.filter((q) => q.section === 'features');
