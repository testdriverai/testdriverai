export const getDefaults = (context) => ({
  ip: context.ip || process.env.TD_IP,
  os: process.env.TD_OS || 'linux',
  redraw: { enabled: false },
  preview: 'ide',
});
