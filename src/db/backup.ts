import { Platform } from 'react-native';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

import type { BackupPayload } from '@/data/types';
import * as repo from '@/db/repository';

function backupFilename(): string {
  const stamp = new Date().toISOString().slice(0, 10);
  return `expense-track-bkp-${stamp}.json`;
}

async function downloadOnWeb(json: string, filename: string): Promise<void> {
  // Web: compartilhamento por URI local não funciona — força download do arquivo.
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}

async function pickJsonOnWeb(): Promise<string | null> {
  return new Promise((resolve, reject) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json,.json,text/plain';
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) {
        resolve(null);
        return;
      }
      try {
        resolve(await file.text());
      } catch (err) {
        reject(err);
      }
    };
    input.oncancel = () => resolve(null);
    input.click();
  });
}

/** Gera o JSON de backup e abre o compartilhamento (ou download no web). */
export async function exportBackup(): Promise<void> {
  const payload = await repo.exportBackupData();
  const json = JSON.stringify(payload, null, 2);
  const filename = backupFilename();

  if (Platform.OS === 'web') {
    await downloadOnWeb(json, filename);
    return;
  }

  const file = new File(Paths.cache, filename);
  file.create({ overwrite: true });
  file.write(json);

  const available = await Sharing.isAvailableAsync();
  if (!available) {
    throw new Error('Compartilhamento não disponível neste dispositivo');
  }

  await Sharing.shareAsync(file.uri, {
    mimeType: 'application/json',
    dialogTitle: 'Exportar backup',
    UTI: 'public.json',
  });
}

/**
 * Abre o seletor de arquivo, importa o JSON e substitui os dados locais.
 * Retorna false se o usuário cancelar.
 */
export async function importBackup(): Promise<boolean> {
  let text: string | null;

  if (Platform.OS === 'web') {
    text = await pickJsonOnWeb();
  } else {
    const picked = await File.pickFileAsync({
      mimeTypes: ['application/json', 'text/plain', '*/*'],
    });
    if (picked.canceled || !picked.result) return false;
    text = await picked.result.text();
  }

  if (text == null) return false;

  let parsed: unknown;
  try {
    parsed = JSON.parse(text) as BackupPayload;
  } catch {
    throw new Error('O arquivo selecionado não é um JSON válido');
  }

  await repo.importBackupData(parsed);
  return true;
}
