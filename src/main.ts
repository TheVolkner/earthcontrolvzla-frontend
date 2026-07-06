import { bootstrapApplication } from '@angular/platform-browser';
import { inject } from '@vercel/analytics';
import { injectSpeedInsights } from '@vercel/speed-insights';
import { appConfig } from './app/app.config';
import { App } from './app/app';
import { environment } from './environments/environment';

// Initialize Vercel Web Analytics
inject({
  mode: environment.production ? 'production' : 'development',
  debug: !environment.production,
});

// Initialize Vercel Speed Insights
injectSpeedInsights();

bootstrapApplication(App, appConfig).catch((err) => console.error(err));
