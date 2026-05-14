import { NextResponse } from "next/server";
import Docker from "dockerode";

const docker = new Docker();

export async function GET() {
  try {
    const [containers, images] = await Promise.all([
      docker.listContainers({ all: true }),
      docker.listImages({ all: true }),
    ]);

    const parsedContainers = containers.map((c) => ({
      id: c.Id.substring(0, 12),
      fullId: c.Id,
      name: c.Names?.[0]?.replace("/", "") ?? "unnamed",
      image: c.Image,
      imageId: c.ImageID,
      state: c.State,
      status: c.Status,
      ports: c.Ports ?? [],
      created: c.Created,
    }));

    const parsedImages = images.map((img) => ({
      id: img.Id.replace("sha256:", "").substring(0, 12),
      fullId: img.Id,
      repoTags: img.RepoTags?.length ? img.RepoTags : ["<none>:<none>"],
      size: img.Size,
      created: img.Created,
      containers: img.Containers,
    }));

    return NextResponse.json({
      containers: parsedContainers,
      images: parsedImages,
    });
  } catch (error) {
    console.error("Docker GET failed:", error);

    return NextResponse.json(
      {
        error:
          "Failed to connect to Docker daemon. Make sure Docker is running and this app has access to the Docker socket.",
      },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const { type, id, action } = await req.json();

    if (!type || !id || !action) {
      return NextResponse.json(
        { error: "Missing type, id, or action" },
        { status: 400 }
      );
    }

    if (type === "container") {
      const container = docker.getContainer(id);

      if (action === "start") {
        await container.start();
      } else if (action === "stop") {
        await container.stop();
      } else if (action === "restart") {
        await container.restart();
      } else if (action === "remove") {
        await container.remove({ force: true });
      } else {
        return NextResponse.json(
          { error: `Unsupported container action: ${action}` },
          { status: 400 }
        );
      }

      return NextResponse.json({ success: true });
    }

    if (type === "image") {
      const image = docker.getImage(id);

      if (action === "remove") {
        await image.remove({ force: true });
      } else {
        return NextResponse.json(
          { error: `Unsupported image action: ${action}` },
          { status: 400 }
        );
      }

      return NextResponse.json({ success: true });
    }

    return NextResponse.json(
      { error: `Unsupported Docker resource type: ${type}` },
      { status: 400 }
    );
  } catch (error) {
    console.error("Docker POST failed:", error);

    return NextResponse.json(
      { error: "Docker action failed" },
      { status: 500 }
    );
  }
}
