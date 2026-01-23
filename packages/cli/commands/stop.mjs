/**
 * stop 命令 - 停止本地服务
 * 
 * 创建时间: 2026-01-20
 */

import chalk from 'chalk';
import ora from 'ora';
import { getConfig } from '../index.mjs';
import { readPidFile, removePidFile, isProcessRunning, killProcess, waitForProcessExit } from '../utils/process.mjs';

/**
 * 停止服务命令
 */
export async function stopCommand(options) {
    const spinner = ora('Stopping DeepSeek Cowork...').start();
    
    try {
        const config = await getConfig();
        const pidPath = config.getPidFilePath();
        const pid = readPidFile(pidPath);
        
        if (!pid) {
            spinner.info('No running service found');
            removePidFile(pidPath);
            return;
        }
        
        if (!isProcessRunning(pid)) {
            spinner.info('Service is not running (stale PID file removed)');
            removePidFile(pidPath);
            return;
        }
        
        // 注意：stop 命令只停止主服务，不停止 daemon 进程
        // daemon 进程由 cleanup 命令专门清理
        
        // 发送 SIGTERM 信号
        spinner.text = 'Sending stop signal...';
        killProcess(pid, 'SIGTERM');
        
        // 等待进程退出
        spinner.text = 'Waiting for service to stop...';
        const stopped = await waitForProcessExit(pid, 10000);
        
        if (stopped) {
            removePidFile(pidPath);
            spinner.succeed('DeepSeek Cowork stopped');
        } else {
            // 强制终止
            spinner.text = 'Force stopping...';
            killProcess(pid, 'SIGKILL');
            
            const forceStopped = await waitForProcessExit(pid, 3000);
            
            if (forceStopped) {
                removePidFile(pidPath);
                spinner.succeed('DeepSeek Cowork force stopped');
            } else {
                spinner.fail('Failed to stop service');
                console.log(chalk.yellow(`\nProcess ${pid} may still be running`));
                console.log(chalk.yellow('You may need to kill it manually'));
            }
        }
        
    } catch (error) {
        spinner.fail(`Failed to stop: ${error.message}`);
        process.exit(1);
    }
}

export default stopCommand;
