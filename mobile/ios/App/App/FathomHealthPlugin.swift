import Capacitor
import HealthKit

/// Writes finished dives to Apple Health as mindful minutes, when the player
/// has turned it on. Write-only: Fathom asks to share mindful sessions and
/// never asks to read anything.
///
/// Devices without Health (iPads before iPadOS 17, some managed devices)
/// report unavailable, and Settings does not offer the switch.
@objc(FathomHealthPlugin)
public class FathomHealthPlugin: CAPPlugin, CAPBridgedPlugin {
  public let identifier = "FathomHealthPlugin"
  public let jsName = "FathomHealth"
  public let pluginMethods: [CAPPluginMethod] = [
    CAPPluginMethod(name: "available", returnType: CAPPluginReturnPromise),
    CAPPluginMethod(name: "authorize", returnType: CAPPluginReturnPromise),
    CAPPluginMethod(name: "saveMindful", returnType: CAPPluginReturnPromise),
  ]

  private lazy var store = HKHealthStore()
  private let mindful = HKCategoryType.categoryType(forIdentifier: .mindfulSession)!

  @objc func available(_ call: CAPPluginCall) {
    call.resolve(["available": HKHealthStore.isHealthDataAvailable()])
  }

  /// Shows the Health permission sheet the first time; after that iOS answers
  /// from what the player chose. Resolves whether Fathom may write.
  @objc func authorize(_ call: CAPPluginCall) {
    guard HKHealthStore.isHealthDataAvailable() else {
      call.resolve(["granted": false])
      return
    }
    store.requestAuthorization(toShare: [mindful], read: nil) { _, _ in
      let status = self.store.authorizationStatus(for: self.mindful)
      call.resolve(["granted": status == .sharingAuthorized])
    }
  }

  @objc func saveMindful(_ call: CAPPluginCall) {
    guard
      let start = call.getDouble("start"),
      let end = call.getDouble("end"),
      end > start
    else {
      call.reject("A mindful session needs a start before its end.")
      return
    }
    guard store.authorizationStatus(for: mindful) == .sharingAuthorized else {
      call.reject("Fathom may not write to Health.", "NOT_AUTHORIZED")
      return
    }
    let sample = HKCategorySample(
      type: mindful,
      value: HKCategoryValue.notApplicable.rawValue,
      start: Date(timeIntervalSince1970: start / 1000),
      end: Date(timeIntervalSince1970: end / 1000))
    store.save(sample) { saved, error in
      if saved {
        call.resolve()
      } else {
        call.reject(error?.localizedDescription ?? "Health did not save the session.")
      }
    }
  }
}
