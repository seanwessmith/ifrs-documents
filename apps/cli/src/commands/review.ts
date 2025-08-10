import { Command } from 'commander';
import { spawn } from 'child_process';
import { join } from 'path';

export const reviewCommand = new Command()
  .name('review')
  .description('Open review UI for document')
  .argument('[documentId]', 'Document ID to review (optional)')
  .option('--port <port>', 'Port for review server', '3001')
  .action(async (documentId: string | undefined, options) => {
    console.log('🚀 Starting IFRS Review UI...\n');
    
    const reviewUIPath = join(process.cwd(), 'apps/review-ui/src/index.ts');
    const port = options.port;
    
    try {
      // Start the review UI server
      const server = spawn('bun', ['--hot', reviewUIPath], {
        stdio: 'inherit',
        env: { ...process.env, PORT: port }
      });
      
      // Open browser after a short delay
      setTimeout(() => {
        const url = documentId 
          ? `http://localhost:${port}?doc=${documentId}`
          : `http://localhost:${port}`;
        
        console.log(`\n📱 Review UI available at: ${url}`);
        console.log(`💡 Tips:`);
        console.log(`   • Select documents from the dropdown`);
        console.log(`   • Filter by unit type and status`);
        console.log(`   • Approve/reject extracted units`);
        console.log(`   • Press Ctrl+C to stop the server\n`);
        
        // Try to open browser (cross-platform)
        const open = process.platform === 'darwin' ? 'open' : 
                    process.platform === 'win32' ? 'start' : 'xdg-open';
                    
        spawn(open, [url], { stdio: 'ignore', detached: true });
      }, 2000);
      
      // Handle shutdown gracefully
      process.on('SIGINT', () => {
        console.log('\n🛑 Shutting down review UI server...');
        server.kill('SIGTERM');
        process.exit(0);
      });
      
      server.on('close', (code) => {
        console.log(`\n📱 Review UI server stopped (code: ${code})`);
        process.exit(code || 0);
      });
      
    } catch (error) {
      console.error('❌ Failed to start review UI:', error);
      console.log('\n💡 Make sure you have:');
      console.log('   • Installed dependencies: bun install');
      console.log('   • Set up environment variables in .env');
      console.log('   • Database is accessible');
      process.exit(1);
    }
  });