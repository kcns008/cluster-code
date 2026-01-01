"""
ClusterEnv - PufferLib Environment for Kubernetes Cluster Management

This environment models a Kubernetes cluster as a reinforcement learning
environment where an agent learns to manage and troubleshoot cluster issues.

Observation Space:
- Cluster health metrics (node status, pod health, resource usage)
- Recent events and alerts
- Current state of deployments

Action Space:
- Diagnostic actions (check logs, describe resources)
- Remediation actions (restart pods, scale deployments)
- Investigation actions (get events, check metrics)

Rewards:
- Positive: Resolving issues, maintaining healthy state
- Negative: Downtime, resource exhaustion, failed actions
"""

import gymnasium as gym
from gymnasium import spaces
import numpy as np
import subprocess
import json
from typing import Dict, List, Any, Optional, Tuple
from dataclasses import dataclass
from enum import IntEnum

try:
    import pufferlib
    import pufferlib.emulation
    PUFFERLIB_AVAILABLE = True
except ImportError:
    PUFFERLIB_AVAILABLE = False


class ClusterAction(IntEnum):
    """Available actions for cluster management"""
    # Diagnostic actions
    GET_NODES = 0
    GET_PODS = 1
    GET_EVENTS = 2
    GET_DEPLOYMENTS = 3
    CHECK_LOGS = 4
    DESCRIBE_UNHEALTHY = 5
    
    # Remediation actions
    RESTART_FAILED_PODS = 6
    SCALE_UP_DEPLOYMENT = 7
    SCALE_DOWN_DEPLOYMENT = 8
    DRAIN_NODE = 9
    UNCORDON_NODE = 10
    
    # Investigation actions
    TOP_NODES = 11
    TOP_PODS = 12
    GET_RESOURCE_QUOTAS = 13
    
    # No-op
    WAIT = 14


@dataclass
class ClusterState:
    """Represents the current state of the cluster"""
    num_nodes: int
    nodes_ready: int
    nodes_not_ready: int
    
    num_pods: int
    pods_running: int
    pods_pending: int
    pods_failed: int
    pods_unknown: int
    
    num_deployments: int
    deployments_available: int
    deployments_unavailable: int
    
    cpu_usage_percent: float
    memory_usage_percent: float
    
    recent_events_warning: int
    recent_events_normal: int
    
    has_pvc_issues: bool
    has_network_issues: bool
    has_resource_pressure: bool
    
    def to_observation(self) -> np.ndarray:
        """Convert state to observation vector"""
        return np.array([
            self.num_nodes / 100.0,
            self.nodes_ready / max(self.num_nodes, 1),
            self.nodes_not_ready / max(self.num_nodes, 1),
            
            self.num_pods / 1000.0,
            self.pods_running / max(self.num_pods, 1),
            self.pods_pending / max(self.num_pods, 1),
            self.pods_failed / max(self.num_pods, 1),
            self.pods_unknown / max(self.num_pods, 1),
            
            self.num_deployments / 100.0,
            self.deployments_available / max(self.num_deployments, 1),
            self.deployments_unavailable / max(self.num_deployments, 1),
            
            self.cpu_usage_percent / 100.0,
            self.memory_usage_percent / 100.0,
            
            min(self.recent_events_warning / 100.0, 1.0),
            min(self.recent_events_normal / 100.0, 1.0),
            
            float(self.has_pvc_issues),
            float(self.has_network_issues),
            float(self.has_resource_pressure),
        ], dtype=np.float32)


class ClusterEnv(gym.Env):
    """
    Kubernetes Cluster Management Environment
    
    This environment connects to a real or simulated Kubernetes cluster
    and allows an RL agent to learn cluster management strategies.
    """
    
    metadata = {'render_modes': ['human', 'rgb_array']}
    
    # Observation space dimension
    OBS_DIM = 18
    # Number of actions
    NUM_ACTIONS = len(ClusterAction)
    
    def __init__(
        self,
        context: Optional[str] = None,
        namespace: str = "default",
        simulation_mode: bool = True,
        max_steps: int = 100,
        render_mode: str = "human",
    ):
        super().__init__()
        
        self.context = context
        self.namespace = namespace
        self.simulation_mode = simulation_mode
        self.max_steps = max_steps
        self.render_mode = render_mode
        
        # Define spaces
        self.observation_space = spaces.Box(
            low=0.0,
            high=1.0,
            shape=(self.OBS_DIM,),
            dtype=np.float32,
        )
        
        self.action_space = spaces.Discrete(self.NUM_ACTIONS)
        
        # Episode tracking
        self.current_step = 0
        self.total_reward = 0.0
        self.state: Optional[ClusterState] = None
        self.action_history: List[int] = []
        
        # Simulation state (for simulation mode)
        self._sim_issues: List[str] = []
        
    def reset(
        self,
        seed: Optional[int] = None,
        options: Optional[Dict] = None,
    ) -> Tuple[np.ndarray, Dict]:
        """Reset the environment"""
        super().reset(seed=seed)
        
        self.current_step = 0
        self.total_reward = 0.0
        self.action_history = []
        
        if self.simulation_mode:
            self._reset_simulation()
        
        self.state = self._get_cluster_state()
        obs = self.state.to_observation()
        
        info = {
            "step": self.current_step,
            "issues": self._get_current_issues(),
        }
        
        return obs, info
    
    def step(self, action: int) -> Tuple[np.ndarray, float, bool, bool, Dict]:
        """Execute an action in the environment"""
        self.current_step += 1
        self.action_history.append(action)
        
        # Execute action
        action_result = self._execute_action(ClusterAction(action))
        
        # Get new state
        prev_state = self.state
        self.state = self._get_cluster_state()
        
        # Calculate reward
        reward = self._calculate_reward(prev_state, self.state, action, action_result)
        self.total_reward += reward
        
        # Check termination
        terminated = self._check_terminated()
        truncated = self.current_step >= self.max_steps
        
        obs = self.state.to_observation()
        info = {
            "step": self.current_step,
            "action": ClusterAction(action).name,
            "action_result": action_result,
            "total_reward": self.total_reward,
            "issues": self._get_current_issues(),
        }
        
        return obs, reward, terminated, truncated, info
    
    def render(self):
        """Render the environment"""
        if self.render_mode == "human" and self.state is not None:
            print(f"\n=== Cluster State (Step {self.current_step}) ===")
            print(f"Nodes: {self.state.nodes_ready}/{self.state.num_nodes} ready")
            print(f"Pods: {self.state.pods_running} running, {self.state.pods_pending} pending, {self.state.pods_failed} failed")
            print(f"Deployments: {self.state.deployments_available}/{self.state.num_deployments} available")
            print(f"Resources: CPU {self.state.cpu_usage_percent:.1f}%, Memory {self.state.memory_usage_percent:.1f}%")
            print(f"Total Reward: {self.total_reward:.2f}")
            if self.action_history:
                last_action = ClusterAction(self.action_history[-1]).name
                print(f"Last Action: {last_action}")
    
    def close(self):
        """Clean up resources"""
        pass
    
    def _reset_simulation(self):
        """Reset simulation state with random issues"""
        self._sim_issues = []
        
        # Randomly introduce issues
        if self.np_random.random() < 0.3:
            self._sim_issues.append("pod_failure")
        if self.np_random.random() < 0.2:
            self._sim_issues.append("node_not_ready")
        if self.np_random.random() < 0.2:
            self._sim_issues.append("resource_pressure")
        if self.np_random.random() < 0.1:
            self._sim_issues.append("pvc_issue")
        if self.np_random.random() < 0.1:
            self._sim_issues.append("network_issue")
    
    def _get_cluster_state(self) -> ClusterState:
        """Get current cluster state"""
        if self.simulation_mode:
            return self._get_simulated_state()
        else:
            return self._get_real_cluster_state()
    
    def _get_simulated_state(self) -> ClusterState:
        """Generate simulated cluster state"""
        # Base healthy state
        num_nodes = 5
        num_pods = 50
        num_deployments = 10
        
        nodes_not_ready = 1 if "node_not_ready" in self._sim_issues else 0
        pods_failed = 5 if "pod_failure" in self._sim_issues else 0
        pods_pending = 3 if "resource_pressure" in self._sim_issues else 0
        
        return ClusterState(
            num_nodes=num_nodes,
            nodes_ready=num_nodes - nodes_not_ready,
            nodes_not_ready=nodes_not_ready,
            num_pods=num_pods,
            pods_running=num_pods - pods_failed - pods_pending,
            pods_pending=pods_pending,
            pods_failed=pods_failed,
            pods_unknown=0,
            num_deployments=num_deployments,
            deployments_available=num_deployments - (1 if pods_failed > 0 else 0),
            deployments_unavailable=1 if pods_failed > 0 else 0,
            cpu_usage_percent=80.0 if "resource_pressure" in self._sim_issues else 40.0,
            memory_usage_percent=75.0 if "resource_pressure" in self._sim_issues else 35.0,
            recent_events_warning=10 if self._sim_issues else 2,
            recent_events_normal=20,
            has_pvc_issues="pvc_issue" in self._sim_issues,
            has_network_issues="network_issue" in self._sim_issues,
            has_resource_pressure="resource_pressure" in self._sim_issues,
        )
    
    def _get_real_cluster_state(self) -> ClusterState:
        """Get state from real Kubernetes cluster"""
        try:
            # Build kubectl command prefix
            kubectl_prefix = ["kubectl"]
            if self.context:
                kubectl_prefix.extend(["--context", self.context])
            
            # Get nodes
            nodes_result = subprocess.run(
                kubectl_prefix + ["get", "nodes", "-o", "json"],
                capture_output=True,
                text=True,
                timeout=30,
            )
            nodes_data = json.loads(nodes_result.stdout) if nodes_result.returncode == 0 else {"items": []}
            
            # Get pods
            pods_result = subprocess.run(
                kubectl_prefix + ["get", "pods", "--all-namespaces", "-o", "json"],
                capture_output=True,
                text=True,
                timeout=30,
            )
            pods_data = json.loads(pods_result.stdout) if pods_result.returncode == 0 else {"items": []}
            
            # Get deployments
            deploy_result = subprocess.run(
                kubectl_prefix + ["get", "deployments", "--all-namespaces", "-o", "json"],
                capture_output=True,
                text=True,
                timeout=30,
            )
            deploy_data = json.loads(deploy_result.stdout) if deploy_result.returncode == 0 else {"items": []}
            
            # Parse node data
            num_nodes = len(nodes_data.get("items", []))
            nodes_ready = sum(
                1 for node in nodes_data.get("items", [])
                if any(
                    cond.get("type") == "Ready" and cond.get("status") == "True"
                    for cond in node.get("status", {}).get("conditions", [])
                )
            )
            
            # Parse pod data
            pods = pods_data.get("items", [])
            num_pods = len(pods)
            pods_running = sum(1 for p in pods if p.get("status", {}).get("phase") == "Running")
            pods_pending = sum(1 for p in pods if p.get("status", {}).get("phase") == "Pending")
            pods_failed = sum(1 for p in pods if p.get("status", {}).get("phase") == "Failed")
            pods_unknown = sum(1 for p in pods if p.get("status", {}).get("phase") == "Unknown")
            
            # Parse deployment data
            deployments = deploy_data.get("items", [])
            num_deployments = len(deployments)
            deployments_available = sum(
                1 for d in deployments
                if d.get("status", {}).get("availableReplicas", 0) >= d.get("spec", {}).get("replicas", 1)
            )
            
            # Get events
            events_result = subprocess.run(
                kubectl_prefix + ["get", "events", "--all-namespaces", "-o", "json"],
                capture_output=True,
                text=True,
                timeout=30,
            )
            events_data = json.loads(events_result.stdout) if events_result.returncode == 0 else {"items": []}
            events = events_data.get("items", [])
            events_warning = sum(1 for e in events if e.get("type") == "Warning")
            events_normal = sum(1 for e in events if e.get("type") == "Normal")
            
            return ClusterState(
                num_nodes=num_nodes,
                nodes_ready=nodes_ready,
                nodes_not_ready=num_nodes - nodes_ready,
                num_pods=num_pods,
                pods_running=pods_running,
                pods_pending=pods_pending,
                pods_failed=pods_failed,
                pods_unknown=pods_unknown,
                num_deployments=num_deployments,
                deployments_available=deployments_available,
                deployments_unavailable=num_deployments - deployments_available,
                cpu_usage_percent=50.0,  # Would need metrics-server for real values
                memory_usage_percent=50.0,
                recent_events_warning=events_warning,
                recent_events_normal=events_normal,
                has_pvc_issues=False,  # Would need more detailed checks
                has_network_issues=False,
                has_resource_pressure=pods_pending > 0,
            )
            
        except Exception as e:
            # Return empty state on error
            return ClusterState(
                num_nodes=0, nodes_ready=0, nodes_not_ready=0,
                num_pods=0, pods_running=0, pods_pending=0, pods_failed=0, pods_unknown=0,
                num_deployments=0, deployments_available=0, deployments_unavailable=0,
                cpu_usage_percent=0, memory_usage_percent=0,
                recent_events_warning=0, recent_events_normal=0,
                has_pvc_issues=False, has_network_issues=False, has_resource_pressure=False,
            )
    
    def _execute_action(self, action: ClusterAction) -> Dict[str, Any]:
        """Execute a cluster management action"""
        result = {"success": False, "message": "", "data": None}
        
        if self.simulation_mode:
            return self._execute_simulated_action(action)
        else:
            return self._execute_real_action(action)
    
    def _execute_simulated_action(self, action: ClusterAction) -> Dict[str, Any]:
        """Execute action in simulation"""
        result = {"success": True, "message": f"Executed {action.name}", "data": None}
        
        if action == ClusterAction.RESTART_FAILED_PODS:
            if "pod_failure" in self._sim_issues:
                self._sim_issues.remove("pod_failure")
                result["message"] = "Restarted failed pods - issue resolved"
            else:
                result["message"] = "No failed pods to restart"
        
        elif action == ClusterAction.UNCORDON_NODE:
            if "node_not_ready" in self._sim_issues:
                self._sim_issues.remove("node_not_ready")
                result["message"] = "Uncordoned node - issue resolved"
        
        elif action == ClusterAction.SCALE_DOWN_DEPLOYMENT:
            if "resource_pressure" in self._sim_issues:
                self._sim_issues.remove("resource_pressure")
                result["message"] = "Scaled down deployment - resource pressure relieved"
        
        return result
    
    def _execute_real_action(self, action: ClusterAction) -> Dict[str, Any]:
        """Execute action on real cluster (read-only for safety)"""
        result = {"success": False, "message": "", "data": None}
        
        kubectl_prefix = ["kubectl"]
        if self.context:
            kubectl_prefix.extend(["--context", self.context])
        
        try:
            if action == ClusterAction.GET_NODES:
                cmd_result = subprocess.run(
                    kubectl_prefix + ["get", "nodes"],
                    capture_output=True,
                    text=True,
                    timeout=30,
                )
                result["success"] = cmd_result.returncode == 0
                result["data"] = cmd_result.stdout
                result["message"] = "Retrieved node information"
            
            elif action == ClusterAction.GET_PODS:
                cmd_result = subprocess.run(
                    kubectl_prefix + ["get", "pods", "--all-namespaces"],
                    capture_output=True,
                    text=True,
                    timeout=30,
                )
                result["success"] = cmd_result.returncode == 0
                result["data"] = cmd_result.stdout
                result["message"] = "Retrieved pod information"
            
            elif action == ClusterAction.GET_EVENTS:
                cmd_result = subprocess.run(
                    kubectl_prefix + ["get", "events", "--all-namespaces", "--sort-by=.lastTimestamp"],
                    capture_output=True,
                    text=True,
                    timeout=30,
                )
                result["success"] = cmd_result.returncode == 0
                result["data"] = cmd_result.stdout
                result["message"] = "Retrieved cluster events"
            
            elif action == ClusterAction.WAIT:
                result["success"] = True
                result["message"] = "Waiting..."
            
            else:
                # For write operations, just log intent (safety)
                result["success"] = True
                result["message"] = f"Would execute: {action.name} (dry-run mode for safety)"
            
        except Exception as e:
            result["message"] = f"Error: {str(e)}"
        
        return result
    
    def _calculate_reward(
        self,
        prev_state: Optional[ClusterState],
        curr_state: ClusterState,
        action: int,
        action_result: Dict,
    ) -> float:
        """Calculate reward based on state transition"""
        reward = 0.0
        
        if prev_state is None:
            return 0.0
        
        # Reward for improving cluster health
        if curr_state.pods_failed < prev_state.pods_failed:
            reward += 10.0 * (prev_state.pods_failed - curr_state.pods_failed)
        
        if curr_state.pods_pending < prev_state.pods_pending:
            reward += 5.0 * (prev_state.pods_pending - curr_state.pods_pending)
        
        if curr_state.nodes_not_ready < prev_state.nodes_not_ready:
            reward += 20.0 * (prev_state.nodes_not_ready - curr_state.nodes_not_ready)
        
        # Penalty for degradation
        if curr_state.pods_failed > prev_state.pods_failed:
            reward -= 15.0 * (curr_state.pods_failed - prev_state.pods_failed)
        
        if curr_state.nodes_not_ready > prev_state.nodes_not_ready:
            reward -= 25.0 * (curr_state.nodes_not_ready - prev_state.nodes_not_ready)
        
        # Reward for resource optimization
        if curr_state.cpu_usage_percent < prev_state.cpu_usage_percent and prev_state.cpu_usage_percent > 70:
            reward += 2.0
        
        # Small penalty for each step (encourage efficiency)
        reward -= 0.1
        
        # Bonus for fully healthy cluster
        if (curr_state.pods_failed == 0 and
            curr_state.nodes_not_ready == 0 and
            curr_state.pods_pending == 0):
            reward += 5.0
        
        return reward
    
    def _check_terminated(self) -> bool:
        """Check if episode should terminate"""
        if self.state is None:
            return False
        
        # Terminate on catastrophic failure
        if self.state.nodes_ready == 0:
            return True
        
        # Terminate on all issues resolved
        if (self.state.pods_failed == 0 and
            self.state.nodes_not_ready == 0 and
            not self.state.has_pvc_issues and
            not self.state.has_network_issues and
            not self.state.has_resource_pressure):
            return True
        
        return False
    
    def _get_current_issues(self) -> List[str]:
        """Get list of current issues"""
        if self.simulation_mode:
            return list(self._sim_issues)
        
        issues = []
        if self.state:
            if self.state.nodes_not_ready > 0:
                issues.append(f"{self.state.nodes_not_ready} node(s) not ready")
            if self.state.pods_failed > 0:
                issues.append(f"{self.state.pods_failed} pod(s) failed")
            if self.state.pods_pending > 0:
                issues.append(f"{self.state.pods_pending} pod(s) pending")
            if self.state.has_resource_pressure:
                issues.append("Resource pressure detected")
        return issues


def env_creator(name: str = "cluster"):
    """PufferLib environment creator function"""
    import functools
    return functools.partial(make, name)


def make(name: str = "cluster", simulation_mode: bool = True, buf=None, **kwargs):
    """Create a ClusterEnv wrapped for PufferLib"""
    env = ClusterEnv(simulation_mode=simulation_mode, **kwargs)
    
    if PUFFERLIB_AVAILABLE:
        return pufferlib.emulation.GymnasiumPufferEnv(env=env, buf=buf)
    else:
        return env


if __name__ == "__main__":
    # Test the environment
    env = ClusterEnv(simulation_mode=True)
    obs, info = env.reset()
    
    print("Initial Observation:", obs)
    print("Initial Issues:", info.get("issues", []))
    
    for i in range(10):
        action = env.action_space.sample()
        obs, reward, terminated, truncated, info = env.step(action)
        env.render()
        
        if terminated or truncated:
            print(f"\nEpisode finished after {i+1} steps")
            break
    
    env.close()
