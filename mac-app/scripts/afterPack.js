const { execFileSync } = require('child_process');
const path = require('path');

exports.default = async function afterPack(context) {
  if (context.electronPlatformName !== 'darwin') return;
  if (context.appOutDir.includes('-temp')) return;

  const appPath = path.join(context.appOutDir, `${context.packager.appInfo.productFilename}.app`);
  const identity = process.env.LOOMLOCAL_SIGN_IDENTITY || process.env.CSC_NAME || '-';
  execFileSync('codesign', [
    '--force',
    '--deep',
    '--sign',
    identity,
    appPath
  ], { stdio: 'inherit' });
};
