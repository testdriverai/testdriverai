const {
  SSMClient,
  SendCommandCommand,
  waitUntilCommandExecuted,
  GetCommandInvocationCommand
} = require('@aws-sdk/client-ssm');
const {
  EC2Client,
  DescribeInstancesCommand
} = require('@aws-sdk/client-ec2');
const fs = require('fs');
const path = require('path');

/**
 * AWS EC2 and SSM management for CLI - connects to existing instances only
 * Instance creation is handled by aws.sh script
 */
class AWSManager {
  constructor() {
    // Load AWS config from .aws-env file
    this.loadAwsConfig();
    
    this.ssm = new SSMClient({ region: this.awsRegion });
    this.ec2 = new EC2Client({ region: this.awsRegion });
    
    // Hard-coded paths on EC2
    this.userBasePath = `C:\\Users\\Administrator`;
    this.pythonPath = `${this.userBasePath}\\AppData\\Local\\Programs\\Python\\Python313\\python.exe`;
    this.scriptPath = `${this.userBasePath}\\Desktop\\pyautogui-cli.py`;
    this.psexecPath = `${this.userBasePath}\\Desktop\\PsExec.exe`;
    this.wsConfigPath = `C:\\Windows\\Temp\\pyautogui-ws.json`;
  }

  /**
   * Load AWS configuration from .aws-env file
   */
  loadAwsConfig() {
    const envFilePath = path.join(process.cwd(), '.aws-env');
    
    if (!fs.existsSync(envFilePath)) {
      throw new Error('.aws-env file not found. Please run the aws.sh script first.');
    }

    const envContent = fs.readFileSync(envFilePath, 'utf8');
    const envVars = {};
    
    // Parse the .aws-env file
    envContent.split('\n').forEach(line => {
      const match = line.match(/^export (\w+)="(.*)"/);
      if (match) {
        const [, key, value] = match;
        envVars[key] = value;
      }
    });

    this.awsRegion = envVars.AWS_REGION;
    this.amiId = envVars.AMI_ID;
    this.instanceType = envVars.INSTANCE_TYPE || 'c5.xlarge';
    this.keyName = envVars.AWS_KEY_NAME;
    this.securityGroupIds = envVars.AWS_SECURITY_GROUP_IDS ? 
      envVars.AWS_SECURITY_GROUP_IDS.split(',') : [];
    this.iamInstanceProfile = envVars.AWS_IAM_INSTANCE_PROFILE;
    this.existingInstanceId = envVars.INSTANCE_ID;
    this.existingPublicIp = envVars.PUBLIC_IP;

    if (!this.awsRegion || !this.amiId || !this.keyName) {
      throw new Error('Missing required AWS configuration in .aws-env file');
    }
  }

  /**
   * Get the EC2 client instance
   */
  getEC2Client() {
    return this.ec2;
  }

  /**
   * Get existing instance information from .aws-env
   */
  getExistingInstanceInfo() {
    if (!this.existingInstanceId || !this.existingPublicIp) {
      throw new Error('No existing instance information found in .aws-env. Please run aws.sh first.');
    }
    
    return {
      instanceId: this.existingInstanceId,
      publicIp: this.existingPublicIp
    };
  }

  /**
   * Get public IP of an existing instance
   */
  async getInstancePublicIP(instanceId) {
    if (this.existingInstanceId === instanceId && this.existingPublicIp) {
      return this.existingPublicIp;
    }

    const command = new DescribeInstancesCommand({
      InstanceIds: [instanceId]
    });
    
    const result = await this.ec2.send(command);
    const instance = result.Reservations[0]?.Instances[0];
    
    if (!instance) {
      throw new Error(`Instance ${instanceId} not found`);
    }
    
    if (instance.State.Name !== 'running') {
      throw new Error(`Instance ${instanceId} is not running (state: ${instance.State.Name})`);
    }
    
    if (!instance.PublicIpAddress) {
      throw new Error(`Instance ${instanceId} does not have a public IP address`);
    }
    
    return instance.PublicIpAddress;
  }

  /**
   * Execute a command on the instance via SSM
   */
  async executeCommand(instanceId, command, timeout = 30) {
    console.log(`🔧 Executing command on ${instanceId}: ${command}`);
    
    const params = {
      InstanceIds: [instanceId],
      DocumentName: 'AWS-RunPowerShellScript',
      Parameters: {
        commands: [command]
      },
      TimeoutSeconds: timeout
    };

    const sendCommand = new SendCommandCommand(params);
    const result = await this.ssm.send(sendCommand);
    const commandId = result.Command.CommandId;

    // Wait for command to complete
    await waitUntilCommandExecuted(
      this.ssm,
      {
        CommandId: commandId,
        InstanceId: instanceId
      },
      {
        maxWaitTime: timeout + 10,
        minDelay: 2,
        maxDelay: 5
      }
    );

    // Get command output
    const getOutput = new GetCommandInvocationCommand({
      CommandId: commandId,
      InstanceId: instanceId
    });
    
    const output = await this.ssm.send(getOutput);
    
    return {
      stdout: output.StandardOutputContent || '',
      stderr: output.StandardErrorContent || '',
      exitCode: output.ResponseCode || 0,
      status: output.Status
    };
  }

  /**
   * Get WebSocket configuration from instance
   */
  async getWebSocketConfig(instanceId) {
    const command = `if (Test-Path '${this.wsConfigPath}') { Get-Content -Raw '${this.wsConfigPath}' } else { Write-Output 'Config file not found at ${this.wsConfigPath}' }`;
    
    const result = await this.executeCommand(instanceId, command);
    
    if (result.stdout && result.stdout.trim() !== `Config file not found at ${this.wsConfigPath}`) {
      try {
        return JSON.parse(result.stdout.trim());
      } catch (error) {
        console.error('Failed to parse WebSocket config:', error);
        return null;
      }
    }
    
    return null;
  }

  /**
   * Check if instance exists and is running
   */
  async isInstanceRunning(instanceId) {
    try {
      const command = new DescribeInstancesCommand({
        InstanceIds: [instanceId]
      });
      
      const result = await this.ec2.send(command);
      const instance = result.Reservations[0]?.Instances[0];
      
      return instance && instance.State.Name === 'running';
    } catch (error) {
      if (error.name === 'InvalidInstanceID.NotFound') {
        return false;
      }
      throw error;
    }
  }
}

module.exports = { AWSManager };
