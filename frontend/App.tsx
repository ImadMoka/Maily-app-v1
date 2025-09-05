import React from 'react';
import { StatusBar } from 'expo-status-bar';
import Index from './app/index';

export default function App() {
  return (
    <>
      <Index />
      <StatusBar style="auto" />
    </>
  );
}