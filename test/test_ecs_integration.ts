import { describe, test, expect } from 'vitest';
import { Point } from "@objects/Point";
import { Frame } from "@objects/Frame";
import { Surface } from "@objects/Surface";

describe("ECS Integration Tests", () => {
  test("Point class functionality", () => {
    const pointA = new Point(0, 0, 0);
    const pointB = new Point(3, 4, 0);
    expect(pointA.distanceTo(pointB)).toBe(5);
  });

  test("Frame connection length calculation", () => {
    const frame = new Frame();
    frame.addPoint("A", new Point(0, 0, 0));
    frame.addPoint("B", new Point(3, 4, 0));
    frame.addConnection("A", "B");
    expect(frame.calculateTotalConnectionLength()).toBe(5);
  });

  test("Surface centroid calculation", () => {
    const surface = new Surface();
    surface.addPoint(new Point(0, 0, 0));
    surface.addPoint(new Point(2, 0, 0));
    surface.addPoint(new Point(1, 2, 0));
    const centroid = surface.calculateCentroid();
    expect(centroid.position.x).toBeCloseTo(1);
    expect(centroid.position.y).toBeCloseTo(2 / 3);
    expect(centroid.position.z).toBeCloseTo(0);
  });
});