import { useEffect, useRef, useCallback } from 'react';
import { pollCommands, reportCommandResult } from '../services/player';

interface Command {
  command_id: number;
  command_type: string;
  payload?: string;
}

interface CommandHandlerProps {
  onCommand?: (command: Command) => void;
}

export default function CommandHandler({ onCommand }: CommandHandlerProps) {
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const handleCommand = useCallback(async (command: Command) => {
    console.log(`[Command] Received: ${command.command_type}`, command);

    try {
      switch (command.command_type) {
        case 'REBOOT':
          // In Electron, close and restart app
          if (window.electronAPI) {
            await reportCommandResult(command.command_id, 'COMPLETED', 'Rebooting...');
            window.electronAPI.exitApp();
          } else {
            await reportCommandResult(command.command_id, 'COMPLETED', 'Reboot command received');
            window.location.reload();
          }
          break;

        case 'SHUTDOWN':
          if (window.electronAPI) {
            await reportCommandResult(command.command_id, 'COMPLETED', 'Shutting down...');
            window.electronAPI.exitApp();
          }
          break;

        case 'RELOAD':
          await reportCommandResult(command.command_id, 'COMPLETED', 'Reloading...');
          window.location.reload();
          break;

        case 'SCREENSHOT':
          if (window.electronAPI) {
            const screenshot = await window.electronAPI.takeScreenshot();
            await reportCommandResult(command.command_id, 'COMPLETED', screenshot ? 'Screenshot captured' : 'Failed');
          } else {
            await reportCommandResult(command.command_id, 'COMPLETED', 'Screenshot (web - not supported)');
          }
          break;

        case 'UPDATE':
          await reportCommandResult(command.command_id, 'COMPLETED', 'Update received - restarting...');
          window.location.reload();
          break;

        case 'CUSTOM':
          // Custom command — just acknowledge
          await reportCommandResult(command.command_id, 'COMPLETED', `Custom command processed: ${command.payload}`);
          break;

        default:
          await reportCommandResult(command.command_id, 'FAILED', `Unknown command: ${command.command_type}`);
      }

      onCommand?.(command);
    } catch (err: any) {
      console.error('[Command] Error handling command:', err);
      await reportCommandResult(command.command_id, 'FAILED', err.message);
    }
  }, [onCommand]);

  // Poll for commands every 10 seconds
  useEffect(() => {
    const poll = async () => {
      try {
        const commands = await pollCommands();
        for (const cmd of commands) {
          await handleCommand(cmd);
        }
      } catch (err) {
        console.error('[Command] Poll error:', err);
      }
    };

    // Initial poll after 5 seconds
    const initialTimeout = setTimeout(poll, 5000);

    // Then poll every 10 seconds
    pollIntervalRef.current = setInterval(poll, 10000);

    return () => {
      clearTimeout(initialTimeout);
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    };
  }, [handleCommand]);

  // This component renders nothing
  return null;
}
