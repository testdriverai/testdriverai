export const getDefaults = (context) => ({
  ip: context.ip || process.env.TD_IP,
  redraw: { enabled: false },
  preview: 'ide',
  dashcam: false,
});
