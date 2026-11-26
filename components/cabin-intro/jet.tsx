// The small red-tailed airliner seen through the cabin window. The intro and
// the landing page hero sky both fly this one drawing. It is decoration only,
// so it is hidden from assistive technology and never takes focus.
export function Jet({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 120 40" focusable="false" aria-hidden="true">
      <path d="M9 19 3 3h9l17 15z" fill="#ED1C24" />
      <path d="M7 22 1 27h9l9-5z" fill="#d5dde6" />
      <path d="M6 21c0-2 3-3 8-3l80-2c12 0 20 3 23 6-3 3-11 5-22 5H15c-6 0-9-3-9-6z" fill="#fff" />
      <path d="M8 23c2 3 4 4 8 4h80c10 0 17-2 21-5-6 2-13 3-22 3H16c-4 0-6-1-8-2z" fill="#c9d3de" />
      <path d="M104 18.5c3 .4 6 1.200 8 2.300l-9 .2z" fill="#22344a" />
      <path d="M52 23 37 37h9l26-14z" fill="#e3e9f0" />
      <rect x="50" y="27" width="13" height="5.500" rx="2.700" fill="#b9c4d0" />
    </svg>
  );
}
