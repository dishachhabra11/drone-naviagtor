// Mission routes
app.get("/api/missions", isAuthenticated, async (req, res) => {
  const missions = await storage.getMissionsByOrganization((req.user as any).id);
  res.json(missions);
});

// Add endpoint for fetching drones assigned to a mission
app.get("/api/missions/:id/drones", isAuthenticated, async (req, res) => {
  try {
    const missionId = parseInt(req.params.id);
    const mission = await storage.getMission(missionId);

    if (!mission) {
      return res.status(404).json({ message: "Mission not found" });
    }

    // Check if mission belongs to the user's organization
    if (mission.organizationId !== (req.user as any).id) {
      return res.status(403).json({ message: "Forbidden" });
    }

    // Get drone assignments for this mission
    const assignments = await storage.getDroneAssignmentsByMission(missionId);

    // Get all drones for these assignments
    const drones = await Promise.all(
      assignments.map(async (assignment) => {
        const drone = await storage.getDrone(assignment.droneId);
        if (drone) {
          return {
            ...drone,
            assignedMissionId: missionId,
          };
        }
        return null;
      })
    );

    // Filter out any null values and return the drones
    res.json(drones.filter((drone): drone is Drone => drone !== null));
  } catch (error) {
    console.error("Error fetching mission drones:", error);
    res.status(500).json({ message: "Error fetching mission drones", error });
  }
});

app.get("/api/missions/:id", isAuthenticated, async (req, res) => {
  // ... existing code ...
});
