export const getDefaults = (context) => ({
  ip: context.ip || process.env.TD_IP,
  preview: 'web',
  cache: 'false'
});
