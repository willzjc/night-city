export const VENUES = Object.freeze([
  { type: 'NOODLE BAR', name: 'NIGHT WIRE', accent: '#ff6949', secondary: '#68ecdc', advert: 'HOT FOOD / ALL NIGHT', icon: 'bowl' },
  { type: 'CYBER CLINIC', name: 'SECOND SKIN', accent: '#64ecd9', secondary: '#f9df6b', advert: 'A BETTER VERSION OF YOU', icon: 'cross' },
  { type: 'ARCADE', name: 'GHOST SIGNAL', accent: '#e983c3', secondary: '#59b9fa', advert: 'LEAVE REALITY ON READ', icon: 'chip' },
  { type: 'LOUNGE', name: 'LOW FREQUENCY', accent: '#f4d45f', secondary: '#f47790', advert: 'OPEN UNTIL THE CITY SLEEPS', icon: 'wave' },
])

export function venueFor(seed) {
  return VENUES[seed % VENUES.length]
}