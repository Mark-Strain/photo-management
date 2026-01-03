import { google } from 'googleapis';
import * as fs from 'fs';
import * as path from 'path';
import { app } from 'electron';
import { BrowserWindow } from 'electron';
import * as http from 'http';
import { URL } from 'url';

interface OAuthCredentials {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}

class GooglePhotosService {
  private oauth2Client: any = null;
  private credentialsPath: string;

  constructor() {
    const dataDir = path.join(app.getPath('userData'), 'data');
    this.credentialsPath = path.join(dataDir, 'google-credentials.json');
  }

  private loadCredentials(): OAuthCredentials | null {
    try {
      if (fs.existsSync(this.credentialsPath)) {
        const data = fs.readFileSync(this.credentialsPath, 'utf8');
        return JSON.parse(data);
      }
    } catch (error) {
      console.error('Error loading credentials:', error);
    }
    return null;
  }

  private saveCredentials(credentials: OAuthCredentials) {
    try {
      const dataDir = path.dirname(this.credentialsPath);
      if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
      }
      fs.writeFileSync(this.credentialsPath, JSON.stringify(credentials, null, 2));
    } catch (error) {
      console.error('Error saving credentials:', error);
    }
  }

  private getOAuth2Client(credentials: OAuthCredentials) {
    return new google.auth.OAuth2(
      credentials.clientId,
      credentials.clientSecret,
      credentials.redirectUri
    );
  }

  async authenticate(credentials: OAuthCredentials): Promise<string> {
    return new Promise((resolve, reject) => {
      const scopes = [
        'https://www.googleapis.com/auth/photoslibrary.readonly'
      ];

      // Create a simple HTTP server to receive the OAuth callback
      const server = http.createServer(async (req, res) => {
        try {
          if (req.url?.startsWith('/oauth2callback')) {
            const port = (server.address() as any)?.port;
            const url = new URL(req.url, `http://localhost:${port}`);
            const code = url.searchParams.get('code');

            if (code) {
              // Get the OAuth client with the correct redirect URI
              const redirectUri = `http://localhost:${port}/oauth2callback`;
              const updatedCredentials = { ...credentials, redirectUri };
              const oauth2Client = this.getOAuth2Client(updatedCredentials);
              
              const { tokens } = await oauth2Client.getToken(code);
              oauth2Client.setCredentials(tokens);
              
              // Save credentials with correct redirect URI
              this.saveCredentials(updatedCredentials);
              
              // Save tokens
              const tokenPath = path.join(path.dirname(this.credentialsPath), 'google-tokens.json');
              fs.writeFileSync(tokenPath, JSON.stringify(tokens, null, 2));
              
              this.oauth2Client = oauth2Client;
              
              res.writeHead(200, { 'Content-Type': 'text/html' });
              res.end('<html><body><h1>Authentication successful! You can close this window.</h1></body></html>');
              
              server.close();
              resolve('success');
            } else {
              res.writeHead(400, { 'Content-Type': 'text/html' });
              res.end('<html><body><h1>Authentication failed. No code received.</h1></body></html>');
              server.close();
              reject(new Error('No authorization code received'));
            }
          }
        } catch (error) {
          res.writeHead(500, { 'Content-Type': 'text/html' });
          res.end('<html><body><h1>Authentication error occurred.</h1></body></html>');
          server.close();
          reject(error);
        }
      });

      server.listen(0, () => {
        const port = (server.address() as any)?.port;
        const redirectUri = `http://localhost:${port}/oauth2callback`;
        
        // Create OAuth client with dynamic redirect URI
        const updatedCredentials = { ...credentials, redirectUri };
        const oauth2Client = this.getOAuth2Client(updatedCredentials);
        
        const authUrl = oauth2Client.generateAuthUrl({
          access_type: 'offline',
          scope: scopes,
          prompt: 'consent',
        });
        
        // Open browser window
        const authWindow = new BrowserWindow({
          width: 600,
          height: 700,
          show: true,
        });
        authWindow.loadURL(authUrl);
      });
    });
  }

  async ensureAuthenticated(): Promise<void> {
    const credentials = this.loadCredentials();
    if (!credentials) {
      throw new Error('Google Photos credentials not configured. Please set up OAuth credentials first.');
    }

    const tokenPath = path.join(path.dirname(this.credentialsPath), 'google-tokens.json');
    
    if (!this.oauth2Client) {
      this.oauth2Client = this.getOAuth2Client(credentials);
      
      if (fs.existsSync(tokenPath)) {
        try {
          const tokens = JSON.parse(fs.readFileSync(tokenPath, 'utf8'));
          this.oauth2Client.setCredentials(tokens);
        } catch (error) {
          throw new Error('Failed to load saved tokens. Please re-authenticate.');
        }
      } else {
        throw new Error('Not authenticated. Please authenticate first.');
      }
    }
  }

  async fetchMediaItems(limit: number = 50): Promise<any[]> {
    await this.ensureAuthenticated();
    
    const photos = (google as any).photoslibrary('v1');
    const allItems: any[] = [];
    let pageToken: string | undefined = undefined;

    do {
      try {
        const response: any = await photos.mediaItems.search({
          auth: this.oauth2Client,
          requestBody: {
            pageSize: limit,
            pageToken: pageToken,
          },
        });

        if (response.data.mediaItems) {
          allItems.push(...response.data.mediaItems);
        }

        pageToken = response.data.nextPageToken || undefined;
      } catch (error) {
        console.error('Error fetching media items:', error);
        break;
      }
    } while (pageToken && allItems.length < 1000); // Limit to 1000 items for now

    return allItems;
  }

  async downloadMediaItem(mediaItem: any, destinationPath: string): Promise<void> {
    if (!mediaItem.baseUrl) {
      throw new Error('Media item does not have a baseUrl');
    }

    const https = require('https');
    const http = require('http');
    const url = require('url');

    return new Promise((resolve, reject) => {
      const parsedUrl = new URL(mediaItem.baseUrl);
      const protocol = parsedUrl.protocol === 'https:' ? https : http;

      protocol.get(mediaItem.baseUrl, (response: any) => {
        if (response.statusCode !== 200) {
          reject(new Error(`Failed to download: ${response.statusCode}`));
          return;
        }

        const fileStream = fs.createWriteStream(destinationPath);
        response.pipe(fileStream);

        fileStream.on('finish', () => {
          fileStream.close();
          resolve();
        });

        fileStream.on('error', (error: Error) => {
          fs.unlink(destinationPath, () => {});
          reject(error);
        });
      }).on('error', (error: Error) => {
        reject(error);
      });
    });
  }
}

export const googlePhotosService = new GooglePhotosService();

