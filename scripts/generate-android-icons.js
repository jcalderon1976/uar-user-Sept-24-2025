const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const sourceIcon = path.join(__dirname, '../src/assets/icon/icon2.png');
const androidResPath = path.join(__dirname, '../android/app/src/main/res');

// Tamaños para iconos normales (ic_launcher.png y ic_launcher_round.png)
const iconSizes = {
  'mipmap-mdpi': 48,
  'mipmap-hdpi': 72,
  'mipmap-xhdpi': 96,
  'mipmap-xxhdpi': 144,
  'mipmap-xxxhdpi': 192,
};

// Tamaños para adaptive icon foreground (ic_launcher_foreground.png)
const adaptiveIconSizes = {
  'mipmap-mdpi': 108,
  'mipmap-hdpi': 162,
  'mipmap-xhdpi': 216,
  'mipmap-xxhdpi': 324,
  'mipmap-xxxhdpi': 432,
};

async function generateIcons() {
  try {
    console.log('🖼️ Generando iconos de Android desde icon2.png...');
    
    // Verificar que el archivo fuente existe
    if (!fs.existsSync(sourceIcon)) {
      throw new Error(`No se encontró el archivo: ${sourceIcon}`);
    }

    // Generar iconos normales (ic_launcher.png y ic_launcher_round.png)
    for (const [folder, size] of Object.entries(iconSizes)) {
      const folderPath = path.join(androidResPath, folder);
      
      // Crear carpeta si no existe
      if (!fs.existsSync(folderPath)) {
        fs.mkdirSync(folderPath, { recursive: true });
      }

      // Generar ic_launcher.png
      const launcherPath = path.join(folderPath, 'ic_launcher.png');
      await sharp(sourceIcon)
        .resize(size, size, {
          fit: 'contain',
          background: { r: 255, g: 255, b: 255, alpha: 0 }
        })
        .toFile(launcherPath);
      console.log(`✅ Generado: ${launcherPath} (${size}x${size})`);

      // Generar ic_launcher_round.png (mismo tamaño)
      const roundPath = path.join(folderPath, 'ic_launcher_round.png');
      await sharp(sourceIcon)
        .resize(size, size, {
          fit: 'contain',
          background: { r: 255, g: 255, b: 255, alpha: 0 }
        })
        .toFile(roundPath);
      console.log(`✅ Generado: ${roundPath} (${size}x${size})`);
    }

    // Generar adaptive icon foreground (ic_launcher_foreground.png)
    for (const [folder, size] of Object.entries(adaptiveIconSizes)) {
      const folderPath = path.join(androidResPath, folder);
      
      // Crear carpeta si no existe
      if (!fs.existsSync(folderPath)) {
        fs.mkdirSync(folderPath, { recursive: true });
      }

      // Generar ic_launcher_foreground.png
      const foregroundPath = path.join(folderPath, 'ic_launcher_foreground.png');
      await sharp(sourceIcon)
        .resize(size, size, {
          fit: 'contain',
          background: { r: 255, g: 255, b: 255, alpha: 0 }
        })
        .toFile(foregroundPath);
      console.log(`✅ Generado: ${foregroundPath} (${size}x${size})`);
    }

    console.log('✅ ¡Iconos generados exitosamente!');
    console.log('📱 Los iconos están listos en: android/app/src/main/res/mipmap-*/');
    
  } catch (error) {
    console.error('❌ Error generando iconos:', error);
    process.exit(1);
  }
}

generateIcons();

