import { ipcMain } from 'electron';
import {
  getOrcaSlicerInfo,
  discoverOrcaProfiles,
  setOrcaSlicerPath,
  sliceStlBase64,
  type OrcaSliceOptions,
} from '../lib/orcaslicer';

export function registerSlicerHandlers() {
  ipcMain.handle('slicer:detect', async () => getOrcaSlicerInfo());

  ipcMain.handle('slicer:profiles', async () => discoverOrcaProfiles());

  ipcMain.handle('slicer:setPath', async (_, path: string) => {
    const success = await setOrcaSlicerPath(path);
    return { success };
  });

  ipcMain.handle('slicer:sliceStl', async (_, args: {
    stlBase64: string;
    options?: OrcaSliceOptions;
  }) => {
    if (!args?.stlBase64) {
      return { success: false, stdout: '', stderr: '', error: 'Missing STL data' };
    }
    return sliceStlBase64(args.stlBase64, args.options);
  });
}
