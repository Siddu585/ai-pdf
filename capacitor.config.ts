import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
    appId: 'com.swappdf.app',
    appName: 'SwapPDF',
    webDir: 'out',
    server: {
        androidScheme: 'https'
    }
};

export default config;
