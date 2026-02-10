export const getDefaults = (context) => ({
  ip: context.ip || process.env.TD_IP,
  redraw: false,
  preview: 'ide',
});
