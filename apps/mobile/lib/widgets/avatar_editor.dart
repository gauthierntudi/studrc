import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:image_cropper/image_cropper.dart';
import 'package:image_picker/image_picker.dart';
import 'package:studrc/widgets/app_icons.dart';
import '../theme/app_theme.dart';

Future<String?> pickAndCropAvatar(BuildContext context) async {
  final source = await showAvatarSourceSheet(context);
  if (source == null || !context.mounted) return null;

  final picked = await ImagePicker().pickImage(
    source: source,
    imageQuality: 96,
  );
  if (picked == null || !context.mounted) return null;

  try {
    final cropped = await ImageCropper().cropImage(
      sourcePath: picked.path,
      compressFormat: ImageCompressFormat.jpg,
      compressQuality: 82,
      maxWidth: 900,
      maxHeight: 900,
      aspectRatio: const CropAspectRatio(ratioX: 1, ratioY: 1),
      uiSettings: [
        AndroidUiSettings(
          toolbarTitle: 'Recadrer',
          toolbarColor: AppTheme.navy,
          toolbarWidgetColor: Colors.white,
          activeControlsWidgetColor: AppTheme.gold,
          backgroundColor: AppTheme.navy,
          cropFrameColor: AppTheme.gold,
          cropGridColor: AppTheme.gold.withValues(alpha: 0.35),
          initAspectRatio: CropAspectRatioPreset.square,
          lockAspectRatio: true,
          hideBottomControls: true,
          cropStyle: CropStyle.circle,
          aspectRatioPresets: const [CropAspectRatioPreset.square],
        ),
        IOSUiSettings(
          title: 'Recadrer',
          doneButtonTitle: 'OK',
          cancelButtonTitle: 'Annuler',
          aspectRatioLockEnabled: true,
          resetAspectRatioEnabled: false,
          aspectRatioPickerButtonHidden: true,
          cropStyle: CropStyle.circle,
          aspectRatioPresets: const [CropAspectRatioPreset.square],
        ),
      ],
    );
    return cropped?.path;
  } catch (_) {
    return picked.path;
  }
}

Future<ImageSource?> showAvatarSourceSheet(BuildContext context) {
  final scheme = Theme.of(context).colorScheme;
  final dark = Theme.of(context).brightness == Brightness.dark;
  final sheet = dark ? const Color(0xFF0A2A4C) : Colors.white;
  final ink = scheme.onSurface;
  final muted = ink.withValues(alpha: 0.55);

  return showModalBottomSheet<ImageSource>(
    context: context,
    isScrollControlled: true,
    backgroundColor: sheet,
    showDragHandle: false,
    shape: const RoundedRectangleBorder(
      borderRadius: BorderRadius.vertical(top: Radius.circular(28)),
    ),
    builder: (context) {
      return SafeArea(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(20, 10, 20, 16),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Container(
                width: 40,
                height: 4,
                decoration: BoxDecoration(
                  color: ink.withValues(alpha: 0.18),
                  borderRadius: BorderRadius.circular(99),
                ),
              ),
              const SizedBox(height: 18),
              Text(
                'Photo de profil',
                style: AppTheme.displayText(
                  size: 20,
                  weight: FontWeight.w800,
                  color: ink,
                ),
              ),
              const SizedBox(height: 6),
              Text(
                'Choisissez une image, puis recadrez-la en cercle.',
                textAlign: TextAlign.center,
                style: AppTheme.sansText(size: 13.5, height: 1.4, color: muted),
              ),
              const SizedBox(height: 22),
              _SourceTile(
                icon: AppIcons.image,
                title: 'Choisir dans la galerie',
                subtitle: 'Une photo déjà enregistrée',
                onTap: () {
                  HapticFeedback.selectionClick();
                  Navigator.pop(context, ImageSource.gallery);
                },
              ),
              const SizedBox(height: 10),
              _SourceTile(
                icon: AppIcons.camera,
                title: 'Prendre une photo',
                subtitle: 'Ouvrir l’appareil photo',
                onTap: () {
                  HapticFeedback.selectionClick();
                  Navigator.pop(context, ImageSource.camera);
                },
              ),
              const SizedBox(height: 8),
              TextButton(
                onPressed: () => Navigator.pop(context),
                child: Text(
                  'Annuler',
                  style: AppTheme.sansText(
                    size: 15,
                    weight: FontWeight.w700,
                    color: muted,
                  ),
                ),
              ),
            ],
          ),
        ),
      );
    },
  );
}

class _SourceTile extends StatelessWidget {
  const _SourceTile({
    required this.icon,
    required this.title,
    required this.subtitle,
    required this.onTap,
  });

  final IconData icon;
  final String title;
  final String subtitle;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final dark = Theme.of(context).brightness == Brightness.dark;
    final ink = Theme.of(context).colorScheme.onSurface;
    return Material(
      color: dark ? const Color(0xFF12325A) : const Color(0xFFF4F6F8),
      borderRadius: BorderRadius.circular(18),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(18),
        child: Padding(
          padding: const EdgeInsets.fromLTRB(14, 14, 16, 14),
          child: Row(
            children: [
              Container(
                width: 48,
                height: 48,
                decoration: const BoxDecoration(
                  color: AppTheme.gold,
                  shape: BoxShape.circle,
                ),
                child: Icon(icon, size: 22, color: AppTheme.navy),
              ),
              const SizedBox(width: 14),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      title,
                      style: AppTheme.sansText(
                        size: 16,
                        weight: FontWeight.w700,
                        color: ink,
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      subtitle,
                      style: AppTheme.sansText(
                        size: 13,
                        color: ink.withValues(alpha: 0.52),
                      ),
                    ),
                  ],
                ),
              ),
              Icon(
                AppIcons.chevronRight,
                size: 18,
                color: ink.withValues(alpha: 0.35),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class ProfileAvatar extends StatelessWidget {
  const ProfileAvatar({
    super.key,
    required this.url,
    required this.name,
    required this.size,
    this.uploading = false,
    this.onEdit,
  });

  final String? url;
  final String name;
  final double size;
  final bool uploading;
  final VoidCallback? onEdit;

  @override
  Widget build(BuildContext context) {
    final photo = url?.trim() ?? '';
    final initial = name.isEmpty ? '?' : name[0].toUpperCase();
    final badge = (size * 0.34).clamp(28.0, 36.0);

    Widget fallback() {
      return ColoredBox(
        color: AppTheme.gold,
        child: Center(
          child: Text(
            initial,
            style: AppTheme.sansText(
              size: size * 0.36,
              weight: FontWeight.w800,
              color: AppTheme.navy,
            ),
          ),
        ),
      );
    }

    return SizedBox(
      width: size,
      height: size,
      child: Stack(
        clipBehavior: Clip.none,
        children: [
          GestureDetector(
            onTap: uploading ? null : onEdit,
            child: DecoratedBox(
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                border: Border.all(color: AppTheme.gold, width: 2),
              ),
              child: Padding(
                padding: const EdgeInsets.all(2),
                child: ClipOval(
                  child: photo.isEmpty
                      ? fallback()
                      : CachedNetworkImage(
                          imageUrl: photo,
                          width: size,
                          height: size,
                          fit: BoxFit.cover,
                          errorWidget: (_, _, _) => fallback(),
                        ),
                ),
              ),
            ),
          ),
          if (uploading)
            Positioned.fill(
              child: DecoratedBox(
                decoration: BoxDecoration(
                  color: AppTheme.navy.withValues(alpha: 0.55),
                  shape: BoxShape.circle,
                ),
                child: const Center(
                  child: SizedBox(
                    width: 22,
                    height: 22,
                    child: CircularProgressIndicator(
                      strokeWidth: 2.4,
                      color: Colors.white,
                    ),
                  ),
                ),
              ),
            ),
          if (onEdit != null)
            Positioned(
              right: -2,
              bottom: -2,
              child: Material(
                color: AppTheme.gold,
                shape: const CircleBorder(),
                elevation: 2,
                child: InkWell(
                  customBorder: const CircleBorder(),
                  onTap: uploading ? null : onEdit,
                  child: SizedBox(
                    width: badge,
                    height: badge,
                    child: Icon(
                      AppIcons.camera,
                      size: badge * 0.46,
                      color: AppTheme.navy,
                    ),
                  ),
                ),
              ),
            ),
        ],
      ),
    );
  }
}
