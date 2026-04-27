import { registerRootComponent } from 'expo';
import { NativeModules, Platform } from 'react-native';

console.log('Available NativeModules:', Object.keys(NativeModules).filter(k => k.includes('Map') || k.includes('MMKV')));

import App from './App';
registerRootComponent(App);
