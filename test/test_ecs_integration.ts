import { describe, test, expect } from 'vitest';
import { Point3D, FrameGeometry, SurfaceGeometry } from '@utils/geometry';

describe("ECS Integration Tests", () => {
  test("Point3D class functionality", () => {
    const pointA = new Point3D(0, 0, 0);
    const pointB = new Point3D(3, 4, 0);
    expect(pointA.distanceTo(pointB)).toBe(5);
  });

  test("Frame connection length calculation", () => {
    const frame = new FrameGeometry();
    frame.addPoint("A", new Point3D(0, 0, 0));
    frame.addPoint("B", new Point3D(3, 4, 0));
    frame.addConnection("A", "B");
    expect(frame.calculateTotalConnectionLength()).toBe(5);
  });

  test("Surface centroid calculation", () => {
    const surface = new SurfaceGeometry();
    surface.addPoint(new Point3D(0, 0, 0));
    surface.addPoint(new Point3D(2, 0, 0));
    surface.addPoint(new Point3D(1, 2, 0));
    const centroid = surface.calculateCentroid();
    expect(centroid.x).toBeCloseTo(1);
    expect(centroid.y).toBeCloseTo(2 / 3);
    expect(centroid.z).toBeCloseTo(0);
  });
});