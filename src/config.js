export const API_URL = 'https://script.google.com/macros/s/AKfycbx2qc5SrbyPDrxn3bUcqTX9Dm7U9uKZBmojlgo7OeBcsOogbdV0mbjGONj1faDZssI/exec';

export const DENOMS = [
  { valor: 100000, tipo: 'billete' },
  { valor: 50000,  tipo: 'billete' },
  { valor: 20000,  tipo: 'billete' },
  { valor: 10000,  tipo: 'billete' },
  { valor: 5000,   tipo: 'billete' },
  { valor: 2000,   tipo: 'billete' },
  { valor: 1000,   tipo: 'moneda'  },
  { valor: 500,    tipo: 'moneda'  },
  { valor: 200,    tipo: 'moneda'  },
  { valor: 100,    tipo: 'moneda'  },
  { valor: 50,     tipo: 'moneda'  },
];

export const TIPOS_MOV = [
  { id: 'INGRESO', label: '💰 Ingreso' },
  { id: 'EGRESO',  label: '📤 Egreso' },
  { id: 'FLETE',   label: '🛵 Flete (domiciliario)' },
  { id: 'SPA',     label: '💆 SPA (traslado tienda → spa)' },
  { id: 'SPA_QR',  label: '📱 SPA QR / transferencia' },
];

export const SEDES = [
  { nombre: 'Retiro', lat: 6.063707594896208, lng: -75.5014224181076 },
  { nombre: 'Palmas', lat: 6.152350532459246, lng: -75.53244266228306 },
];

export const RADIO_SEDE_METROS = 300;