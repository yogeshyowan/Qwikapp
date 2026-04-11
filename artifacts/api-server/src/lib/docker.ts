import { logger } from "./logger";

export interface DeployedApp {
  containerId: string;
  port: number;
  subdomain: string;
}

function getRandomPort(min = 4000, max = 9000): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

async function getDocker() {
  try {
    const { default: Docker } = await import("dockerode");
    return new Docker({ socketPath: "/var/run/docker.sock" });
  } catch {
    return null;
  }
}

export async function buildAndRunApp(
  projectId: number,
  subdomain: string,
  files: { filename: string; content: string }[]
): Promise<DeployedApp> {
  const docker = await getDocker();
  if (!docker) {
    throw new Error("Docker not available on this host");
  }

  const tarStream = await createTarFromFiles(files);
  const imageName = `userapp-${projectId}:latest`;

  logger.info({ projectId, imageName }, "Building Docker image");

  const buildStream = await docker.buildImage(tarStream as never, {
    t: imageName,
  });

  await new Promise<void>((resolve, reject) => {
    docker.modem.followProgress(
      buildStream,
      (err: Error | null) => {
        if (err) reject(err);
        else resolve();
      }
    );
  });

  const port = getRandomPort();

  // Remove existing container if any
  try {
    const existing = docker.getContainer(`userapp-${projectId}`);
    await existing.stop().catch(() => {});
    await existing.remove({ force: true }).catch(() => {});
  } catch {
    // No existing container
  }

  const container = await docker.createContainer({
    Image: imageName,
    name: `userapp-${projectId}`,
    ExposedPorts: { "3000/tcp": {} },
    HostConfig: {
      PortBindings: { "3000/tcp": [{ HostPort: String(port) }] },
      RestartPolicy: { Name: "unless-stopped" },
      Memory: 256 * 1024 * 1024,
      CpuShares: 256,
    },
  });

  await container.start();
  logger.info({ projectId, port, subdomain }, "Container started");

  return { containerId: container.id, port, subdomain };
}

export async function stopAndRemoveApp(containerId: string): Promise<void> {
  const docker = await getDocker();
  if (!docker) return;

  try {
    const container = docker.getContainer(containerId);
    await container.stop();
    await container.remove({ force: true });
    logger.info({ containerId }, "Container stopped and removed");
  } catch (err) {
    logger.warn({ containerId, err }, "Failed to stop/remove container");
  }
}

export async function getContainerStatus(containerId: string): Promise<string> {
  const docker = await getDocker();
  if (!docker) return "docker_unavailable";

  try {
    const container = docker.getContainer(containerId);
    const info = await container.inspect();
    return info.State.Status;
  } catch {
    return "not_found";
  }
}

async function createTarFromFiles(
  files: { filename: string; content: string }[]
): Promise<unknown> {
  const tar = await import("tar-stream");
  const pack = tar.pack();

  for (const file of files) {
    const buf = Buffer.from(file.content, "utf-8");
    pack.entry({ name: file.filename }, buf);
  }

  pack.finalize();
  return pack;
}
